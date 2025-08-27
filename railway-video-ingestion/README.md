# Video Ingestion Service

A lightweight Railway service for ingesting videos from YouTube, TikTok, Facebook, X, and Reddit using yt-dlp.

## Features

- **Fast ingestion**: Extract video metadata, audio streams, and subtitles
- **Redis caching**: 24-hour cache for repeated requests
- **Background processing**: Non-blocking job queue
- **Health monitoring**: Built-in health checks and canary testing
- **Manual updates**: Safe yt-dlp update endpoint

## API Endpoints

### POST /ingest
Start a video ingestion job.

```json
{
  "url": "https://youtube.com/watch?v=dQw4w9WgXcQ"
}
```

Response:
```json
{
  "job_id": "uuid-here",
  "status": "queued",
  "message": "Ingestion job started"
}
```

### GET /jobs/{job_id}
Get job status and results.

Response:
```json
{
  "job_id": "uuid-here",
  "status": "completed",
  "progress": 100,
  "result": {
    "video_id": "dQw4w9WgXcQ",
    "title": "Rick Astley - Never Gonna Give You Up",
    "duration": 212,
    "formats": [...],
    "subtitles": {...}
  }
}
```

### GET /health
Health check endpoint for monitoring.

## Railway Deployment

1. Create new Railway project
2. Connect this repository
3. Add Redis service to project
4. Set environment variables:
   - `REDIS_URL` (automatically set by Railway Redis)
   - `PORT` (automatically set by Railway)

## Environment Variables

- `REDIS_URL`: Redis connection string
- `PORT`: Server port (default: 8000)

## Local Development

```bash
pip install -r requirements.txt
redis-server  # Start Redis locally
python main.py
```

## Manual yt-dlp Updates

When YouTube changes break ingestion:

```bash
curl -X POST https://your-service.railway.app/update-ytdlp
```

Test with canary videos after update.
