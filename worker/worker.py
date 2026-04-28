"""
AI Task Platform — Background Worker Service
Processes tasks from Redis queue and updates MongoDB.
"""

import os
import signal
import sys
import time
import traceback
from datetime import datetime, timezone

import redis
from pymongo import MongoClient
from bson import ObjectId

from processors import process

# Configuration
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/ai-task-platform")
QUEUE_NAME = "task_queue"
WORKER_ID = os.getenv("HOSTNAME", f"worker-{os.getpid()}")

# Graceful shutdown
shutdown = False


def signal_handler(_sig, _frame):
    global shutdown
    print(f"\n[{WORKER_ID}] Shutdown signal received. Finishing current task...")
    shutdown = True


signal.signal(signal.SIGTERM, signal_handler)
signal.signal(signal.SIGINT, signal_handler)


def add_log(collection, task_id, message, level="info"):
    """Add a log entry to a task."""
    collection.update_one(
        {"_id": ObjectId(task_id)},
        {
            "$push": {
                "logs": {
                    "timestamp": datetime.now(timezone.utc),
                    "message": message,
                    "level": level,
                }
            },
            "$set": {"updatedAt": datetime.now(timezone.utc)},
        },
    )


def process_task(collection, task_id):
    """Process a single task."""
    # Fetch task
    task = collection.find_one({"_id": ObjectId(task_id)})
    if not task:
        print(f"[{WORKER_ID}] Task {task_id} not found, skipping")
        return

    # Update status to running
    collection.update_one(
        {"_id": ObjectId(task_id)},
        {"$set": {"status": "running", "updatedAt": datetime.now(timezone.utc)}},
    )
    add_log(collection, task_id, f"Worker {WORKER_ID} picked up the task")

    try:
        operation = task["operation"]
        input_text = task["inputText"]

        add_log(collection, task_id, f"Processing operation: {operation}")

        # Process the task
        result = process(operation, input_text)

        # Update with success
        collection.update_one(
            {"_id": ObjectId(task_id)},
            {
                "$set": {
                    "status": "success",
                    "result": result,
                    "updatedAt": datetime.now(timezone.utc),
                }
            },
        )
        add_log(collection, task_id, f"Task completed successfully. Result length: {len(result)} chars")
        print(f"[{WORKER_ID}] ✅ Task {task_id} completed: {operation}")

    except Exception as e:
        error_msg = str(e)
        tb = traceback.format_exc()

        collection.update_one(
            {"_id": ObjectId(task_id)},
            {
                "$set": {
                    "status": "failed",
                    "errorMessage": error_msg,
                    "updatedAt": datetime.now(timezone.utc),
                }
            },
        )
        add_log(collection, task_id, f"Task failed: {error_msg}", level="error")
        print(f"[{WORKER_ID}] ❌ Task {task_id} failed: {error_msg}")
        print(tb)


def main():
    print(f"[{WORKER_ID}] Starting worker...")
    print(f"[{WORKER_ID}] Redis: {REDIS_HOST}:{REDIS_PORT}")
    print(f"[{WORKER_ID}] MongoDB: {MONGO_URI}")

    # Connect to Redis with retry
    r = None
    for attempt in range(10):
        try:
            r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)
            r.ping()
            print(f"[{WORKER_ID}] ✅ Connected to Redis")
            break
        except redis.ConnectionError:
            wait = min(2 ** attempt, 30)
            print(f"[{WORKER_ID}] Redis not ready, retrying in {wait}s...")
            time.sleep(wait)
    else:
        print(f"[{WORKER_ID}] ❌ Could not connect to Redis. Exiting.")
        sys.exit(1)

    # Connect to MongoDB with retry
    mongo_client = None
    db = None
    for attempt in range(10):
        try:
            mongo_client = MongoClient(MONGO_URI)
            mongo_client.admin.command("ping")
            db_name = MONGO_URI.rsplit("/", 1)[-1].split("?")[0]
            db = mongo_client[db_name]
            print(f"[{WORKER_ID}] ✅ Connected to MongoDB (db: {db_name})")
            break
        except Exception:
            wait = min(2 ** attempt, 30)
            print(f"[{WORKER_ID}] MongoDB not ready, retrying in {wait}s...")
            time.sleep(wait)
    else:
        print(f"[{WORKER_ID}] ❌ Could not connect to MongoDB. Exiting.")
        sys.exit(1)

    tasks_collection = db["tasks"]

    print(f"[{WORKER_ID}] 🔄 Listening for tasks on queue: {QUEUE_NAME}")

    while not shutdown:
        try:
            # BRPOP blocks until a task is available (timeout 5s to check shutdown)
            result = r.brpop(QUEUE_NAME, timeout=5)
            if result is None:
                continue

            _, task_id = result
            print(f"[{WORKER_ID}] 📦 Received task: {task_id}")
            process_task(tasks_collection, task_id)

        except redis.ConnectionError:
            print(f"[{WORKER_ID}] Redis connection lost. Reconnecting...")
            time.sleep(2)
            try:
                r.ping()
            except Exception:
                pass

        except Exception as e:
            print(f"[{WORKER_ID}] Unexpected error: {e}")
            time.sleep(1)

    print(f"[{WORKER_ID}] Worker shut down gracefully")
    if mongo_client:
        mongo_client.close()


if __name__ == "__main__":
    main()
