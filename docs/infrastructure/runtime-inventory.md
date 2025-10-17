# Runtime & Deployment Inventory

This document summarizes how the worker and related infrastructure are structured, how to health-check them, and example deployment configs.

## Components

- **Worker service** (`worker/src/index.ts`, compiled to `worker/dist/index.js`)
  - Express server.
  - Binds to `HOST` (default `0.0.0.0`) and `PORT` (default `8080`).
  - Health endpoint: `GET /healthz` → `200 ok`.
  - Other routes: `/routes`, `/debug`, `/ingest`, `/trim`, `/ingest/test`, `/media/*`.
  - Startup guard: requires `YT_DLP_PATH` set; otherwise exits to avoid accidental runs.

- **Container image (Cloud Run–compatible)** (`worker/Dockerfile`)
  - Base: Node 20 (Debian bullseye).
  - Installs `ffmpeg` and `yt-dlp`.
  - `ENV PORT=8080`, `EXPOSE 8080`, `CMD ["npm","start"]`.

- **Production guidance** (`docs/worker-prod.md`)
  - Examples for running under systemd and Docker/Compose.
  - Key env vars (see below).

- **Firebase project**
  - `firebase.json`, `firestore.rules`, `firestore.indexes.json`, `storage.rules`.
  - Functions source under `functions/`.

- **GCS CORS**
  - GitHub Actions workflows: `.github/workflows/deploy-cors.yml`, `deploy-cors-run.yml`.

## Worker environment variables

Required/important:
- `HOST` (default `0.0.0.0`)
- `PORT` (default `8080`)
- `YT_DLP_PATH` (required by startup guard)
- `YT_DLP_COOKIES` (path to cookies file; optional but recommended)
- `INGEST_CALLBACK_URL` (URL in the app receiving callbacks)
- `INGEST_CALLBACK_SECRET` (shared secret)
- `WORKER_PUBLIC_URL` (used for serving local media in dev)
- Optional storage selection: `GCS_BUCKET` or Cloudflare-* envs

## Health probes

- Probe path: `GET /healthz`
- Port: `8080`
- Scheme: `HTTP`
- Bind `HOST=0.0.0.0` in containers or remote environments.

### Docker Compose example

```yaml
services:
  worker:
    build: ./worker
    environment:
      HOST: "0.0.0.0"
      PORT: "8080"
      YT_DLP_PATH: "/usr/local/bin/yt-dlp"
    ports:
      - "8080:8080"
    healthcheck:
      test: ["CMD", "curl", "-fsS", "http://localhost:8080/healthz"]
      interval: 10s
      timeout: 3s
      retries: 5
      start_period: 10s
```

### Kubernetes probe example (not currently in repo)

```yaml
containers:
- name: worker
  image: your-registry/worker:tag
  env:
  - name: HOST
    value: "0.0.0.0"
  - name: PORT
    value: "8080"
  ports:
  - containerPort: 8080
  readinessProbe:
    httpGet:
      path: /healthz
      port: 8080
      scheme: HTTP
    initialDelaySeconds: 10
    periodSeconds: 10
    timeoutSeconds: 3
    failureThreshold: 3
  livenessProbe:
    httpGet:
      path: /healthz
      port: 8080
      scheme: HTTP
    initialDelaySeconds: 15
    periodSeconds: 10
    timeoutSeconds: 3
    failureThreshold: 3
```

### Cloud Run notes

- Cloud Run automatically health-checks the container port. Ensure `PORT=8080` and bind to `0.0.0.0`.
- Use the `worker/Dockerfile` to build and deploy.

## Local verification commands (Windows PowerShell)

```powershell
# TCP connectivity
Test-NetConnection -ComputerName 127.0.0.1 -Port 8080

# Health endpoint
$r = Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8080/healthz
"STATUS:$($r.StatusCode)"; "BODY:$($r.Content)"

# Routes listing
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8080/routes | Select-Object -ExpandProperty Content

# Debug env info
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8080/debug | Select-Object -ExpandProperty Content

# List listeners on port 8080
Get-NetTCPConnection -LocalPort 8080 | Select-Object LocalAddress,LocalPort,State,OwningProcess
```

## Notes

- Ensure `YT_DLP_PATH` is set in any environment where the worker starts.
- For containers/remote servers, prefer `HOST=0.0.0.0` so health checks from outside the process can reach it.
- Health checks should use HTTP (not HTTPS) when targeting the worker directly.
