const redis = require('../config/redis');

const QUEUE_NAME = 'task_queue';

/**
 * Enqueue a task for processing by pushing its ID to the Redis queue.
 * @param {string} taskId - The MongoDB ObjectId of the task
 * @returns {Promise<number>} The length of the queue after push
 */
const enqueueTask = async (taskId) => {
  try {
    const result = await redis.lpush(QUEUE_NAME, taskId.toString());
    console.log(`📋 Task ${taskId} enqueued. Queue length: ${result}`);
    return result;
  } catch (error) {
    console.error(`❌ Failed to enqueue task ${taskId}:`, error.message);
    throw new Error('Failed to enqueue task. Please try again.');
  }
};

/**
 * Get the current queue length.
 * @returns {Promise<number>}
 */
const getQueueLength = async () => {
  try {
    return await redis.llen(QUEUE_NAME);
  } catch (error) {
    console.error('Failed to get queue length:', error.message);
    return -1;
  }
};

module.exports = { enqueueTask, getQueueLength, QUEUE_NAME };
