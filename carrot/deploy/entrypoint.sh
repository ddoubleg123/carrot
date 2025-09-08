#!/usr/bin/env bash
set -euo pipefail

# Optional: show target DB (sanitized)
echo "[boot] Starting Carrot app..."
echo "[boot] DATABASE_URL provider: $(echo "$DATABASE_URL" | sed -E 's#^([a-z]+):.*$#\1#')"

# Run Prisma migrations (idempotent)
./node_modules/.bin/prisma migrate deploy

# Start app
npm start
