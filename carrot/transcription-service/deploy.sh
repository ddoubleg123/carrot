#!/bin/bash

# Google Cloud Run Vosk Transcription Service Deployment Script
# Make sure you have gcloud CLI installed and authenticated

set -e

# Configuration
PROJECT_ID="involuted-river-466315-p0"  # Your Firebase project ID
SERVICE_NAME="vosk-transcription"
REGION="us-central1"
IMAGE_NAME="gcr.io/$PROJECT_ID/$SERVICE_NAME"

echo "🚀 Deploying Vosk Transcription Service to Google Cloud Run"
echo "Project: $PROJECT_ID"
echo "Service: $SERVICE_NAME"
echo "Region: $REGION"

# Build and push the Docker image
echo "📦 Building Docker image..."
docker build -t $IMAGE_NAME .

echo "📤 Pushing image to Google Container Registry..."
docker push $IMAGE_NAME

# Deploy to Cloud Run
echo "🚀 Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image $IMAGE_NAME \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 900 \
  --max-instances 10 \
  --set-env-vars MODEL_PATH=/app/models/vosk-model-small-en-us-0.15 \
  --project $PROJECT_ID

# Get the service URL
echo "✅ Getting service URL..."
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --platform managed --region $REGION --format 'value(status.url)' --project $PROJECT_ID)

echo ""
echo "🎉 Deployment completed successfully!"
echo "Service URL: $SERVICE_URL"
echo ""
echo "📝 Next steps:"
echo "1. Add this URL to your .env.local file:"
echo "   TRANSCRIPTION_SERVICE_URL=$SERVICE_URL"
echo ""
echo "2. Test the service:"
echo "   curl $SERVICE_URL/health"
echo ""
echo "3. Your audio posts will now automatically trigger background transcription!"
