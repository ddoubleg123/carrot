#!/bin/bash

# DeepSeek Coder Infrastructure Setup Script
# Phase 0: Local Pilot

set -e

echo "🚀 Setting up DeepSeek Coder Infrastructure..."

# Check prerequisites
echo "📋 Checking prerequisites..."
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is required but not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is required but not installed. Please install Docker Compose first."
    exit 1
fi

echo "✅ Prerequisites check passed"

# Create environment file
echo "📝 Creating environment configuration..."
cat > .env << EOF
# DeepSeek Coder Infrastructure Configuration
OLLAMA_URL=http://localhost:11434
VLLM_URL=http://localhost:8000
REDIS_URL=redis://localhost:6379
NODE_ENV=development

# Rate limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Cache settings
CACHE_TTL_SECONDS=3600

# Safety settings
ENABLE_MODERATION=true
ENABLE_PII_DETECTION=true
ENABLE_SECRET_SCANNING=true

# Logging
LOG_LEVEL=debug
LOG_FILE=router.log
EOF

echo "✅ Environment file created"

# Start services
echo "🐳 Starting Docker services..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 10

# Check Ollama health
echo "🔍 Checking Ollama health..."
for i in {1..30}; do
    if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        echo "✅ Ollama is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ Ollama failed to start after 30 attempts"
        exit 1
    fi
    sleep 2
done

# Pull DeepSeek models
echo "📥 Pulling DeepSeek models..."
echo "Pulling deepseek-coder:6.7b..."
docker exec deepseek-infra-ollama-1 ollama pull deepseek-coder:6.7b

echo "Pulling deepseek-coder-v2:16b..."
docker exec deepseek-infra-ollama-1 ollama pull deepseek-coder-v2:16b

# Verify models
echo "🔍 Verifying models..."
docker exec deepseek-infra-ollama-1 ollama list

# Check router health
echo "🔍 Checking router health..."
for i in {1..30}; do
    if curl -s http://localhost:8080/health > /dev/null 2>&1; then
        echo "✅ Router is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ Router failed to start after 30 attempts"
        exit 1
    fi
    sleep 2
done

# Run smoke tests
echo "🧪 Running smoke tests..."
./test-smoke.sh

echo "🎉 Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Configure Cursor to use: http://localhost:8080/v1/chat/completions"
echo "2. Test with: curl -X POST http://localhost:8080/v1/chat/completions \\"
echo "   -H 'Content-Type: application/json' \\"
echo "   -H 'X-Task-Type: editor' \\"
echo "   -d '{\"messages\":[{\"role\":\"user\",\"content\":\"Fix this: The code is not working good.\"}]}'"
echo ""
echo "📊 Monitor logs: docker-compose logs -f router"
echo "🛑 Stop services: docker-compose down"
