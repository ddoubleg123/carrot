# Carrot System Architecture & Deployment Guide

## Repository Structure

### Main Application
- **Repository**: `ddoubleg123/carrot`
- **Local Path**: `C:\Users\danie\CascadeProjects\windsurf-project\`
- **Technology**: Next.js, Firebase, Prisma, TypeScript
- **Purpose**: Main Carrot social video app

### Video Ingestion Service
- **Repository**: `ddoubleg123/carrot-video-ingestion` ⚠️ **SEPARATE REPOSITORY**
- **Local Path**: `C:\Users\danie\carrot-video-ingestion\`
- **Technology**: Python FastAPI, yt-dlp, Redis
- **Purpose**: Video URL processing and metadata extraction

## Deployment Configuration

### Railway Deployment
- **Service**: Connected to `carrot-video-ingestion` repository
- **Build Method**: Docker (Dockerfile)
- **Status**: ✅ Successfully deployed
- **URL**: [Get from Railway dashboard]

### Required Services
- **Redis**: For job queuing (needs to be added)
- **Video Ingestion API**: FastAPI service on Railway

## Integration Points

### Carrot App Configuration
Update `carrot/.env.local`:
```env
VIDEO_INGESTION_SERVICE_URL=https://[railway-service-url]
```

### API Endpoints
- `GET /` - Health check
- `GET /health` - Service health with Redis/yt-dlp test
- `POST /ingest` - Start video ingestion job
- `GET /jobs/{job_id}` - Get job status and results

## Important Notes

⚠️ **Critical**: Video ingestion service is in a **separate repository** to avoid Railway's Node.js detection issues with the main carrot repository.

🔧 **Next Steps**:
1. Add Redis service to Railway project
2. Get Railway service URL
3. Update Carrot app configuration
4. Test integration

## File Locations

### Video Ingestion Service Files
```
C:\Users\danie\carrot-video-ingestion\
├── main.py           # FastAPI service
├── requirements.txt  # Python dependencies  
└── Dockerfile       # Docker build config
```

### Main Carrot App Files
```
C:\Users\danie\CascadeProjects\windsurf-project\
├── carrot/          # Next.js app
├── functions/       # Firebase functions
├── worker/          # Background worker
└── [other services] # Various microservices
```

## Troubleshooting

### Railway Build Issues
- Ensure connected to `carrot-video-ingestion` repository (not `carrot`)
- Verify Docker build is selected (not Node.js/npm)
- Check for any `package.json` files in the clean repository

### Integration Issues
- Verify Railway service URL in Carrot app config
- Check Redis connection for job queuing
- Test API endpoints with curl/Postman
