# AI Agent Training Setup

## Current Status

**AI agent training is disabled on the Render free tier** due to memory limitations (512MB limit). The embedding generation and batch processing operations cause server crashes.

## Running AI Training Locally

To use the full AI training capabilities, run the application locally:

### 1. Prerequisites

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your database and API keys
```

### 2. Required Environment Variables

```env
# Database
DATABASE_URL="your_postgresql_connection_string"

# AI Training (optional - for full functionality)
DEEPSEEK_API_KEY="your_deepseek_api_key"

# Firebase (for media uploads)
NEXT_PUBLIC_FIREBASE_PROJECT_ID="your_project_id"
FIREBASE_STORAGE_BUCKET="your_bucket_name"
# ... other Firebase config
```

### 3. Run Locally

```bash
# Start the development server
npm run dev

# The AI training features will be fully available locally
```

### 4. AI Training Features Available Locally

- ✅ **Agent Creation & Management**
- ✅ **Content Feeding to Agents**
- ✅ **Batch Processing**
- ✅ **Memory Storage & Retrieval**
- ✅ **Embedding Generation**
- ✅ **Agent Conversations**

## Production Deployment Options

### Option 1: Upgrade Render Plan
- Upgrade to a paid Render plan with more memory (1GB+)
- Remove the memory limitations in the code
- Full AI training will be available

### Option 2: Alternative Hosting
- **Vercel Pro**: Better memory limits for AI workloads
- **Railway**: Good for AI applications
- **DigitalOcean App Platform**: More memory options
- **AWS/GCP**: Full control over resources

### Option 3: Hybrid Approach
- Keep main app on Render free tier
- Deploy AI training service separately on a more powerful server
- Use API calls between services

## Current Render Behavior

On Render (free tier):
- ✅ **All UI features work normally**
- ✅ **Agent creation and display**
- ✅ **Chat interface with agents**
- ❌ **AI training/feeding disabled** (returns mock responses)
- ❌ **Memory storage disabled**
- ❌ **Embedding generation disabled**

## Testing AI Features

To test AI training features:

1. **Run locally**: `npm run dev`
2. **Navigate to**: `/feed-agents` page
3. **Create agents** and feed them content
4. **Test batch processing** with multiple agents

## Memory Usage Notes

The AI training system requires significant memory for:
- Text chunking and processing
- Embedding generation (vector creation)
- Database operations (memory storage)
- Batch processing multiple agents

**Minimum recommended**: 1GB RAM for small-scale training
**Recommended**: 2GB+ RAM for production use

## Support

For questions about AI training setup or deployment options, please refer to the main documentation or create an issue.
