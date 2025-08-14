# Google Cloud Run Vosk Transcription Service Deployment Script (Windows)
# Make sure you have gcloud CLI installed and authenticated

$ErrorActionPreference = "Stop"

# Configuration
$PROJECT_ID = "involuted-river-466315-p0"  # Your Firebase project ID
$SERVICE_NAME = "vosk-transcription"
$REGION = "us-central1"
$IMAGE_NAME = "gcr.io/$PROJECT_ID/$SERVICE_NAME"

Write-Host "🚀 Deploying Vosk Transcription Service to Google Cloud Run" -ForegroundColor Green
Write-Host "Project: $PROJECT_ID" -ForegroundColor Cyan
Write-Host "Service: $SERVICE_NAME" -ForegroundColor Cyan
Write-Host "Region: $REGION" -ForegroundColor Cyan

# Build and push the Docker image
Write-Host "📦 Building Docker image..." -ForegroundColor Yellow
docker build -t $IMAGE_NAME .

Write-Host "📤 Pushing image to Google Container Registry..." -ForegroundColor Yellow
docker push $IMAGE_NAME

# Deploy to Cloud Run
Write-Host "🚀 Deploying to Cloud Run..." -ForegroundColor Yellow
gcloud run deploy $SERVICE_NAME `
  --image $IMAGE_NAME `
  --platform managed `
  --region $REGION `
  --allow-unauthenticated `
  --memory 2Gi `
  --cpu 2 `
  --timeout 900 `
  --max-instances 10 `
  --set-env-vars MODEL_PATH=/app/models/vosk-model-small-en-us-0.15 `
  --project $PROJECT_ID

# Get the service URL
Write-Host "✅ Getting service URL..." -ForegroundColor Yellow
$SERVICE_URL = gcloud run services describe $SERVICE_NAME --platform managed --region $REGION --format 'value(status.url)' --project $PROJECT_ID

Write-Host ""
Write-Host "🎉 Deployment completed successfully!" -ForegroundColor Green
Write-Host "Service URL: $SERVICE_URL" -ForegroundColor Cyan
Write-Host ""
Write-Host "📝 Next steps:" -ForegroundColor Yellow
Write-Host "1. Add this URL to your .env.local file:" -ForegroundColor White
Write-Host "   TRANSCRIPTION_SERVICE_URL=$SERVICE_URL" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Test the service:" -ForegroundColor White
Write-Host "   curl $SERVICE_URL/health" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Your audio posts will now automatically trigger background transcription!" -ForegroundColor White
