# Architecture Document — AI Task Processing Platform

## 1. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Kubernetes Cluster                        │
│                                                                  │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐                │
│  │ Frontend  │────▶│ Backend  │────▶│  Redis   │                │
│  │ (React)   │     │ (Express)│     │ (Queue)  │                │
│  │ 2 replicas│     │ 2 replicas│    │ 1 replica│                │
│  └──────────┘     └────┬─────┘     └────┬─────┘                │
│                         │                │                       │
│                         ▼                ▼                       │
│                    ┌──────────┐    ┌──────────┐                 │
│                    │ MongoDB  │    │  Worker   │                 │
│                    │ (DB)     │◀───│ (Python)  │                 │
│                    │ 1 replica│    │ 3 replicas│                 │
│                    └──────────┘    └──────────┘                 │
│                                                                  │
│  ┌──────────┐                                                   │
│  │ Ingress  │ ← External Traffic                                │
│  │ (nginx)  │                                                   │
│  └──────────┘                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Request Flow

1. **User** accesses the frontend via Ingress.
2. **Frontend** (React SPA) makes API calls to `/api/*`.
3. **Ingress** routes `/api/*` to the Backend service.
4. **Backend** authenticates via JWT, creates a Task in MongoDB with `pending` status.
5. **Backend** pushes the task ID to Redis queue (`LPUSH task_queue`).
6. **Worker** picks up the task via `BRPOP task_queue` (blocking pop, FIFO order).
7. **Worker** updates status to `running`, processes the text, and sets `success`/`failed`.
8. **Frontend** polls the API to show updated status.

---

## 2. Worker Scaling Strategy

### Horizontal Scaling

Workers are **stateless** — they hold no local state and communicate entirely through Redis (queue) and MongoDB (persistence). This makes them ideal for horizontal scaling.

**Scaling mechanisms:**

| Method | Description |
|--------|-------------|
| **Manual** | `kubectl scale deployment worker --replicas=N` |
| **HPA** | Horizontal Pod Autoscaler based on CPU/memory metrics |
| **KEDA** | Event-driven autoscaler based on Redis queue length |

**Recommended HPA configuration:**
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: worker-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: worker
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

### Concurrency Safety

- Redis `BRPOP` is atomic — no two workers can pick up the same task.
- MongoDB updates use `_id` filters — no race conditions on task status.
- Each worker processes one task at a time, ensuring predictable resource usage.

---

## 3. Handling High Task Volume (100k tasks/day)

### Throughput Analysis

| Metric | Value |
|--------|-------|
| Tasks per day | 100,000 |
| Tasks per second (avg) | ~1.16 |
| Task processing time | ~10-50ms (text ops) |
| Single worker throughput | ~20-100 tasks/sec |
| **Required workers (avg)** | **1 (with 3 for headroom)** |
| Peak handling (10x spike) | 3 workers handle ~60-300 tasks/sec |

### Optimization for High Volume

1. **Batch processing**: Workers can be enhanced to pull multiple tasks per iteration.
2. **Connection pooling**: MongoDB connection pool (default 100) handles concurrent writes.
3. **Redis pipelining**: Batch Redis operations to reduce round trips.
4. **Task TTL**: Auto-delete completed tasks after 30 days to manage storage.

### Resource Estimates (100k tasks/day)

| Component | CPU | Memory | Storage |
|-----------|-----|--------|---------|
| Backend (2 pods) | 200m each | 256Mi each | — |
| Workers (3 pods) | 200m each | 256Mi each | — |
| MongoDB | 500m | 512Mi | ~1GB/month |
| Redis | 100m | 128Mi | ~50MB peak queue |

---

## 4. Database Indexing Strategy

### User Collection
```javascript
{ email: 1 }          // Unique, for login lookups
```

### Task Collection
```javascript
{ userId: 1, createdAt: -1 }   // Dashboard: user's tasks sorted by date
{ userId: 1, status: 1 }       // Filtering by status per user
{ createdAt: -1 }               // Global sorting/cleanup queries
```

### Index Design Rationale

- **Compound index `(userId, createdAt)`**: Covers the most frequent query — "show me my tasks, newest first." MongoDB can use this for both filtering and sorting without a separate sort stage.
- **Compound index `(userId, status)`**: Enables efficient dashboard filtering (e.g., "show my failed tasks").
- **Avoid over-indexing**: We don't index `operation` or `result` since they're rarely queried independently.

---

## 5. Handling Redis Failure

### Failure Scenarios and Mitigations

| Scenario | Mitigation |
|----------|------------|
| **Redis temporarily down** | ioredis reconnect strategy with exponential backoff (200ms → 5s). Workers block on `BRPOP` and auto-resume when Redis recovers. |
| **Redis crashes (data loss)** | Tasks remain in MongoDB with `pending` status. A recovery script can re-enqueue all pending tasks. |
| **Network partition** | Workers detect connection loss and log warnings. Kubernetes liveness probe fails after 3 missed checks, triggering pod restart. |
| **Queue overflow** | Redis list has no inherent size limit. Monitor queue length via `/api/health` endpoint. Alert if queue length exceeds threshold. |

### Recovery Script
```python
# Re-enqueue stuck pending tasks (run manually or as a CronJob)
for task in db.tasks.find({"status": "pending"}):
    redis.lpush("task_queue", str(task["_id"]))
```

### Data Durability
- Tasks are **always persisted in MongoDB first**, then enqueued to Redis.
- Even if Redis loses all data, no task is lost — only processing is delayed.
- Workers update MongoDB status at every stage, providing an audit trail.

---

## 6. Staging and Production Environments

### Environment Separation

```
infra/
├── base/          # Shared manifests
├── overlays/
│   ├── staging/   # Staging overrides (fewer replicas, debug logging)
│   └── production/# Production overrides (more replicas, optimized settings)
└── argocd/
    ├── staging-app.yaml
    └── production-app.yaml
```

### Key Differences

| Config | Staging | Production |
|--------|---------|------------|
| Namespace | `ai-task-staging` | `ai-task-platform` |
| Backend replicas | 1 | 2+ |
| Worker replicas | 1 | 3+ |
| MongoDB | Shared dev instance | Dedicated with backups |
| Redis | No persistence | AOF persistence enabled |
| Logging | Debug level | Info level |
| Domain | `staging.ai-task.com` | `app.ai-task.com` |
| Secrets | Dev values | Production-grade |

### Deployment Flow

```
Developer pushes to main
  → CI builds images (tagged with commit SHA)
  → CI updates staging manifests
  → Argo CD auto-syncs staging
  → QA validates staging
  → Manual promotion: update production manifests
  → Argo CD auto-syncs production
```

This ensures production deployments are always tested in staging first, with a manual gate between environments.
