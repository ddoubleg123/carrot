# Ingest Worker: Production Setup (Headless)

This guide prepares the worker for production, where the server is headless and needs to ingest YouTube reliably.

## 1) Prereqs

- Node.js 20+
- ffmpeg available on PATH (libx264, aac)
- yt-dlp available on PATH (or set YT_DLP_PATH)
- A secure cookies file for YouTube (Netscape format)

## 2) Generate cookies.txt

1. Sign into YouTube in your browser
2. Install a cookies exporter extension (e.g., "Get cookies.txt")
3. Export cookies for youtube.com (Netscape format)
4. Copy the file to the server, e.g. `/etc/yt-dlp/cookies.txt`
5. Protect it: `chown worker:worker /etc/yt-dlp/cookies.txt && chmod 600 /etc/yt-dlp/cookies.txt`

Note: Cookies expire. Refresh the file periodically.

## 3) Environment variables

Set the following for the worker process:

- `YT_DLP_COOKIES` = `/etc/yt-dlp/cookies.txt`
- `YT_DLP_PATH` (optional) = `/usr/local/bin/yt-dlp`
- `INGEST_CALLBACK_URL` = `https://<app-domain>/api/ingest/callback`
- `INGEST_CALLBACK_SECRET` = `<strong-secret>`
- `WORKER_PUBLIC_URL` = `https://<worker-domain>` (for serving local media in dev)
- `GCS_BUCKET` or `CLOUDFLARE_*` (optional) to control where outputs are uploaded

The worker already adds robust yt-dlp flags: modern UA, Referer, Android player client, geo-bypass. Cookies improve success on gated videos.

## 4) systemd example

```
[Unit]
Description=Carrot Ingest Worker
After=network.target

[Service]
Environment=YT_DLP_COOKIES=/etc/yt-dlp/cookies.txt
Environment=YT_DLP_PATH=/usr/local/bin/yt-dlp
Environment=INGEST_CALLBACK_URL=https://app.example.com/api/ingest/callback
Environment=INGEST_CALLBACK_SECRET=change_me
WorkingDirectory=/opt/windsurf-project
ExecStart=/usr/bin/node scripts/launch-worker.mjs
User=carrot
Group=carrot
Restart=always
RestartSec=5
NoNewPrivileges=true
ProtectSystem=full
ProtectHome=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

## 5) Docker example

```yaml
services:
  worker:
    image: node:20
    working_dir: /app
    volumes:
      - ./windsurf-project:/app
      - /etc/yt-dlp/cookies.txt:/etc/yt-dlp/cookies.txt:ro
    environment:
      YT_DLP_COOKIES: /etc/yt-dlp/cookies.txt
      YT_DLP_PATH: /usr/local/bin/yt-dlp
      INGEST_CALLBACK_URL: https://app.example.com/api/ingest/callback
      INGEST_CALLBACK_SECRET: change_me
    command: ["node", "scripts/launch-worker.mjs"]
```

## 6) Validation checklist

- Start worker and tail logs
- Run an ingest from the app with a known public YouTube URL
- Observe states: downloading → transcoding → uploading → completed
- On failure, check worker logs and the UI toast; stderr is captured for diagnosis

## 7) Maintenance

- Refresh cookies monthly (or when ingest starts failing with app-gate/403 errors)
- Keep yt-dlp up to date
- Monitor logs; alert on repeated failures
