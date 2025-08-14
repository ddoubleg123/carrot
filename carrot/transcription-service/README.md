# Vosk Transcription Service

A Google Cloud Run service that provides automatic speech-to-text transcription for audio posts using the Vosk speech recognition engine.

## 🎯 Overview

This service automatically transcribes audio files uploaded to your social platform:

1. **User uploads audio** → Post created with `transcriptionStatus: 'pending'`
2. **Background job triggers** → Calls this Cloud Run service
3. **Service processes audio** → Downloads, converts, and transcribes using Vosk
4. **Updates database** → Saves transcription back to Firestore
5. **Users see transcription** → Automatically appears in the UI

## 🏗️ Architecture

```
Audio Upload → Firebase Storage → Next.js API → Cloud Run Vosk Service → Firestore
```

## 💰 Cost Analysis

**Google Cloud Run Pricing** (very cost-effective):
- **CPU**: $0.00002400 per vCPU-second
- **Memory**: $0.00000250 per GiB-second  
- **Requests**: $0.40 per million requests

**Example costs for 5-minute audio transcription**:
- Processing time: ~30 seconds
- Cost per transcription: ~$0.001-0.005 (less than 1 cent!)
- 1000 transcriptions/month: ~$1-5

**Compared to alternatives**:
- OpenAI Whisper API: $0.006/minute ($0.03 for 5-minute audio)
- AssemblyAI: Limited free tier, then paid
- **Vosk**: Unlimited usage after setup

## 🚀 Deployment

### Prerequisites

1. **Google Cloud CLI** installed and authenticated
2. **Docker** installed and running
3. **Firebase project** with Firestore enabled

### Quick Deployment

**Windows (PowerShell)**:
```powershell
cd transcription-service
.\deploy.ps1
```

**Linux/Mac (Bash)**:
```bash
cd transcription-service
chmod +x deploy.sh
./deploy.sh
```

### Manual Deployment

```bash
# 1. Build Docker image
docker build -t gcr.io/your-project-id/vosk-transcription .

# 2. Push to Google Container Registry
docker push gcr.io/your-project-id/vosk-transcription

# 3. Deploy to Cloud Run
gcloud run deploy vosk-transcription \
  --image gcr.io/your-project-id/vosk-transcription \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 900 \
  --max-instances 10
```

## ⚙️ Configuration

### Environment Variables

Add to your `.env.local`:
```bash
TRANSCRIPTION_SERVICE_URL=https://vosk-transcription-xxx-uc.a.run.app
```

### Database Schema

The service expects these fields in your `posts` table:
```sql
transcription TEXT,
transcriptionStatus VARCHAR(20) DEFAULT 'pending',
transcriptionLanguage VARCHAR(10) DEFAULT 'en',
transcriptionProcessedAt TIMESTAMP
```

## 🔧 API Endpoints

### Health Check
```bash
GET /health
```
Response:
```json
{
  "status": "healthy",
  "model_loaded": true
}
```

### Transcribe Audio
```bash
POST /transcribe
Content-Type: application/json

{
  "postId": "post_123",
  "audioUrl": "https://firebasestorage.googleapis.com/..."
}
```

Response:
```json
{
  "success": true,
  "postId": "post_123",
  "transcription": "Hello, this is a test transcription.",
  "status": "completed"
}
```

## 🎛️ Model Configuration

### Current Model
- **Model**: `vosk-model-small-en-us-0.15`
- **Size**: ~50MB
- **Language**: English
- **Accuracy**: Good for most use cases

### Alternative Models

**Tiny Model** (~20MB):
```dockerfile
RUN wget https://alphacephei.com/vosk/models/vosk-model-en-us-0.22-lgraph.zip
```

**Large Model** (~1.8GB, higher accuracy):
```dockerfile
RUN wget https://alphacephei.com/vosk/models/vosk-model-en-us-0.22.zip
```

**Multilingual Models**:
- Spanish: `vosk-model-es-0.42`
- French: `vosk-model-fr-0.22`
- German: `vosk-model-de-0.21`

## 🔍 Monitoring

### Logs
```bash
gcloud logs read --service=vosk-transcription --limit=50
```

### Metrics
- Check Cloud Run console for CPU, memory, and request metrics
- Monitor error rates and response times
- Set up alerts for failed transcriptions

## 🐛 Troubleshooting

### Common Issues

**1. Service not responding**
```bash
# Check service status
gcloud run services describe vosk-transcription --region=us-central1

# Check logs
gcloud logs read --service=vosk-transcription --limit=10
```

**2. Transcription failures**
- Check audio file format (supports MP3, WAV, M4A, OGG)
- Verify Firebase Storage permissions
- Check service memory/CPU limits

**3. High costs**
- Monitor request volume
- Adjust max-instances if needed
- Consider using smaller model for high volume

### Error Codes

- **400**: Missing postId or audioUrl
- **500**: Audio download failed
- **500**: Audio conversion failed  
- **500**: Transcription processing failed
- **500**: Database update failed

## 🔒 Security

### Authentication
- Service allows unauthenticated requests (internal use only)
- Firestore access controlled by service account
- Audio files accessed via signed URLs

### Best Practices
- Keep service URL private (don't expose publicly)
- Monitor usage for abuse
- Set reasonable max-instances limit

## 📈 Scaling

### Performance Tuning
- **Memory**: 2Gi (can reduce to 1Gi for smaller models)
- **CPU**: 2 vCPU (can reduce to 1 for light usage)
- **Timeout**: 900s (15 minutes max)
- **Max instances**: 10 (adjust based on usage)

### High Volume Optimization
- Use smaller Vosk model for faster processing
- Implement request queuing for burst traffic
- Consider regional deployment for global users

## 🎉 Success!

Once deployed, your audio posts will automatically get transcribed in the background. Users will see:

1. **Immediate upload success** - no waiting
2. **"Transcription processing..."** status
3. **Automatic transcription appearance** when ready
4. **Manual editing capability** if needed

The system provides the best of both worlds: automatic transcription when possible, manual fallback when needed, and excellent user experience throughout!
