# AI Task Processing Platform

A full-stack AI task processing platform built with **MERN stack**, **Python worker**, **Docker**, **Kubernetes**, and **Argo CD**.

## 🏗️ Architecture

| Service | Technology | Description |
|---------|------------|-------------|
| Frontend | React + Vite | Modern SPA with dark theme UI |
| Backend | Node.js + Express | REST API with JWT authentication |
| Worker | Python | Background task processor |
| Database | MongoDB | Persistent data storage |
| Queue | Redis | Task queue for async processing |

## ✨ Features

- User registration & login (JWT authentication)
- Create AI text processing tasks (uppercase, lowercase, reverse, word count)
- Asynchronous task processing via Redis queue
- Real-time status tracking (pending → running → success/failed)
- Task logs timeline
- Re-run failed tasks

## 🚀 Quick Start (Docker Compose)

### Prerequisites
- Docker & Docker Compose installed

### Run
```bash
# Clone the repository
git clone https://github.com/yourusername/ai-task-platform.git
cd ai-task-platform

# Start all services
docker-compose up --build

# Access the app
# Frontend: http://localhost:3000
# Backend API: http://localhost:5000/api/health
```

### Stop
```bash
docker-compose down
# To remove data volumes:
docker-compose down -v
```

## 🛠️ Local Development (Without Docker)

### Prerequisites
- Node.js 20+
- Python 3.12+
- MongoDB running locally on port 27017
- Redis running locally on port 6379

### Backend
```bash
cd backend
cp .env.example .env    # Edit .env with your settings
npm install
npm run dev             # Starts on http://localhost:5000
```

### Frontend
```bash
cd frontend
npm install
npm run dev             # Starts on http://localhost:3000
```

### Worker
```bash
cd worker
pip install -r requirements.txt
python worker.py
```

## 📦 Docker

Each service has a multi-stage Dockerfile:

```bash
# Build individual images
docker build -t ai-task-frontend ./frontend
docker build -t ai-task-backend ./backend
docker build -t ai-task-worker ./worker
```

All containers run as **non-root users** for security.

## ☸️ Kubernetes Deployment

### Prerequisites
- Kubernetes cluster (k3s, minikube, or cloud)
- kubectl configured

### Deploy
```bash
# Create namespace and apply manifests
kubectl apply -f infra/base/namespace.yaml
kubectl apply -f infra/base/configmap.yaml
kubectl apply -f infra/base/secrets.yaml
kubectl apply -f infra/base/mongodb/
kubectl apply -f infra/base/redis/
kubectl apply -f infra/base/backend/
kubectl apply -f infra/base/worker/
kubectl apply -f infra/base/frontend/

# Verify
kubectl get pods -n ai-task-platform
```

### Features
- Resource limits & requests for all pods
- Liveness & readiness probes
- ConfigMaps and Secrets for configuration
- PersistentVolumeClaim for MongoDB data
- Workers support scaling to multiple replicas

## 🔄 Argo CD (GitOps)

### Setup
```bash
# Install Argo CD
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Apply the application manifest
kubectl apply -f infra/argocd/application.yaml

# Access Argo CD UI
kubectl port-forward svc/argocd-server -n argocd 8080:443
# Open https://localhost:8080
```

Auto-sync is enabled — any changes to `infra/base/` in the main branch are automatically deployed.

## 🔁 CI/CD (GitHub Actions)

The pipeline runs on every push to `main`:

1. **Lint** — ESLint (frontend + backend) + flake8 (worker)
2. **Build & Push** — Docker images pushed to Docker Hub
3. **Update Infra** — Image tags updated in K8s manifests

### Required GitHub Secrets
| Secret | Description |
|--------|-------------|
| `DOCKER_HUB_USERNAME` | Docker Hub username |
| `DOCKER_HUB_TOKEN` | Docker Hub access token |
| `GH_PAT` | GitHub Personal Access Token (for pushing manifest updates) |

## 🔒 Security

- Password hashing with **bcrypt** (12 salt rounds)
- **JWT** authentication with 24h expiry
- **Helmet** middleware for HTTP security headers
- **Rate limiting** (100 req/15min general, 20 req/15min auth)
- **Input validation** with express-validator
- No hardcoded secrets — environment variables and K8s Secrets
- Non-root Docker containers

## 📖 API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | No | Register new user |
| POST | `/api/auth/login` | No | Login |
| GET | `/api/auth/me` | Yes | Get current user |
| POST | `/api/tasks` | Yes | Create and queue task |
| GET | `/api/tasks` | Yes | List user's tasks |
| GET | `/api/tasks/:id` | Yes | Get task details |
| POST | `/api/tasks/:id/run` | Yes | Re-run failed task |
| DELETE | `/api/tasks/:id` | Yes | Delete task |
| GET | `/api/health` | No | Health check |

## 📐 Architecture Document

See [architecture.md](./architecture.md) for detailed documentation on:
- Worker scaling strategy
- Handling 100k tasks/day
- Database indexing strategy
- Redis failure handling
- Staging vs production deployment

## 📁 Project Structure

```
├── frontend/          # React + Vite SPA
├── backend/           # Node.js + Express API
├── worker/            # Python background processor
├── infra/             # Kubernetes + Argo CD manifests
│   ├── base/          # K8s manifests
│   └── argocd/        # Argo CD application
├── .github/workflows/ # CI/CD pipeline
├── docker-compose.yml # Local development
├── architecture.md    # Architecture document
└── README.md          # This file
```
