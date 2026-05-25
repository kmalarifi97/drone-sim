# server

FastAPI + Postgres event log + crash diagnosis for the drone sim. Runs in Docker Compose (db + api); the web/ app stays native on the host because Vite HMR is fiddly through Docker.

From the repo root: `docker compose up -d --build`, then `docker compose exec api alembic upgrade head`. API listens on `http://localhost:8000` (healthcheck at `/healthz`).
