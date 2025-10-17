# Carrot App - System State Documentation

## Database Configuration

**Database Type**: SQLite  
**Location**: `carrot/prisma/dev.db` (local development)  
**Schema**: `carrot/prisma/schema.prisma`  
**ORM**: Prisma Client  

### Key Tables for Transcription
- **posts**: Contains `audioTranscription` and `transcriptionStatus` fields
- **users**: Contains user profile data including `profilePhoto` and `image`

## Transcription System Architecture

### Current Status: PLACEHOLDER SYSTEM
- Transcription endpoints exist but use placeholder text
- Real Vosk service is NOT deployed
- System shows "processing" then placeholder completion

### Transcription Flow
1. **Upload**: Audio/video post created → `transcriptionStatus: 'processing'`
2. **Trigger**: `/api/posts` calls `/api/audio/trigger-transcription`
3. **Process**: Calls `/api/audio/transcribe` with postId and audioUrl
4. **Complete**: Updates database with transcription text and status

### Transcription Database Fields
```sql
-- In posts table
audioTranscription  String?  -- The transcribed text
transcriptionStatus String?  -- 'processing', 'completed', 'failed'
audioUrl           String?  -- Audio file URL
videoUrl           String?  -- Video file URL (audio extracted for transcription)
```

## Installed Tools & Services

### Development Environment
- **Node.js**: Installed
- **Next.js**: Framework for the app
- **Prisma**: Database ORM
- **Google Cloud CLI**: Installed (gcloud)
- **Docker**: Installed
- **Firebase**: Authentication and storage

### Environment URLs
- **Development**: `http://localhost:3005`
- **Production**: `https://gotcarrot.com`

## Authentication System
- **NextAuth.js**: Session management
- **Google OAuth**: Primary authentication
- **Firebase**: Additional services

## File Storage
- **Firebase Storage**: Audio/video files
- **Cloudflare Stream**: Video processing and streaming

## Avatar System
**Priority Order**:
1. Database `profilePhoto` (user-uploaded)
2. Session `profilePhoto` 
3. Session OAuth `image`
4. Placeholder avatar

## Known Issues

### Transcription Problems
- ❌ Transcriptions not completing (stuck at "processing")
- ❌ Database queries from external scripts failing
- ❌ Vosk service not deployed (using placeholders)

### Command Execution Issues
- Commands return exit code 0 but show truncated/empty output
- Database check scripts don't display results properly
- Makes system state verification difficult

## Media Processing

### Audio Posts
- Uploaded to Firebase Storage
- Automatic transcription triggered on upload
- Transcription saved to `posts.audioTranscription`

### Video Posts  
- Processed through Cloudflare Stream
- Audio extracted for transcription
- Thumbnails generated automatically

## Development Workflow

### Database Operations
```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# View database
npx prisma studio
```

### Transcription Service Deployment
```bash
cd carrot/transcription-service
.\deploy.ps1  # Windows
./deploy.sh   # Linux/Mac
```

## Environment Variables Required

### Core App
- `DATABASE_URL`: SQLite database path
- `NEXTAUTH_URL`: App URL for authentication
- `NEXTAUTH_SECRET`: Session encryption key

### Firebase
- `FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET`
- Various Firebase config keys

### Google OAuth
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

### Cloudflare (Video)
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

## Current System State Summary

✅ **Working**:
- User authentication (Google OAuth)
- Post creation and display
- Avatar display system
- File uploads to Firebase
- Video processing via Cloudflare

⚠️ **Partially Working**:
- Transcription system (triggers but uses placeholders)
- Database state verification (commands succeed but output truncated)

❌ **Not Working**:
- Real audio/video transcription (Vosk service not deployed)
- Reliable system state monitoring
- External database query scripts

## Next Steps to Fix Transcription

1. **Deploy Vosk Service**: Run deployment script to get real transcription URL
2. **Verify Database State**: Fix command output issues to see actual data
3. **Test End-to-End**: Upload audio/video and verify transcription completion
4. **Monitor Logs**: Check server logs for transcription processing errors
