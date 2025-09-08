# Carrot App

This folder contains the Next.js app. For the full system-wide overview and recovery steps, see the root guide:

- `../CASCADE_STARTUP_GUIDE.md`

## Quick Links

- Health: `/api/healthz`
- Media health: `/api/healthz/media`
- Schema health (dev-only): `/api/dev/admin/schema-health`
- Avatar: `/api/me/avatar`
- Session: `/api/auth/session`

## Local Dev

- Install deps: `npm ci`
- Start dev: `npm run dev`
- Prisma refresh (from repo root):
  - `powershell -ExecutionPolicy Bypass -File ../scripts/prisma-refresh.ps1`
- Apply migrations (SQLite dev):
  - `npx prisma migrate dev`

## Managed Postgres (Deploy)

Ensure `DATABASE_URL` is set in the environment. On startup, run `npx prisma migrate deploy` before `npm start`.

If you deploy via Docker, use the example entrypoint and Dockerfile in `deploy/`.

## Deploy (Render Node service)

- Build: `npm ci && npx prisma generate && npm run build`
- Start: `npx prisma migrate deploy && npm start`

## Deploy (Docker image)

See `deploy/entrypoint.sh` and `deploy/Dockerfile.example`. The entrypoint runs migrations then starts the app.
