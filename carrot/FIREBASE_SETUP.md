# Firebase Configuration Guide

## 🚨 **Current Issue**
The application is experiencing `ERR_HTTP2_PROTOCOL_ERROR` and video loading failures because Firebase environment variables are not configured.

## 🔧 **Required Environment Variables**

Create a `.env.local` file in the root directory with the following variables:

```bash
# Firebase Configuration
# Get these values from your Firebase Console > Project Settings > General > Your apps
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id

# Firebase Admin SDK (for server-side operations)
# Get these from Firebase Console > Project Settings > Service Accounts > Generate new private key
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your_project_id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----\n"
FIREBASE_STORAGE_BUCKET=your_project_id.firebasestorage.app

# Database
DATABASE_URL="postgresql://username:password@localhost:5432/carrot_db"

# Other API Keys
DEEPSEEK_API_KEY=your_deepseek_api_key_here

# NextAuth
NEXTAUTH_SECRET=your_nextauth_secret_here
NEXTAUTH_URL=http://localhost:3000
```

## 📋 **Setup Steps**

1. **Create Firebase Project** (if not already done)
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Create a new project or select existing one

2. **Get Web App Configuration**
   - Go to Project Settings > General
   - Scroll down to "Your apps" section
   - Click "Add app" > Web app (if not already added)
   - Copy the config values to your `.env.local`

3. **Get Admin SDK Credentials**
   - Go to Project Settings > Service Accounts
   - Click "Generate new private key"
   - Download the JSON file
   - Extract the values for `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY`

4. **Configure Storage**
   - Go to Storage in Firebase Console
   - Create a bucket if not exists
   - Note the bucket name for `FIREBASE_STORAGE_BUCKET`

## 🔍 **Current Error Analysis**

The following errors are caused by missing Firebase configuration:

- `ERR_HTTP2_PROTOCOL_ERROR`: Video proxy API fails to initialize Firebase Admin SDK
- `MEDIA_ELEMENT_ERROR: Format error`: Videos can't load from Firebase Storage
- `ChunkLoadError`: JavaScript chunks fail to load due to network issues

## ✅ **After Configuration**

Once you've set up the environment variables:

1. Restart the development server: `npm run dev`
2. The video loading should work properly
3. Firebase Storage URLs should be accessible
4. API endpoints should function correctly

## 🚀 **Production Deployment**

For production deployment on Render:

1. Add all environment variables to your Render service
2. Ensure `FIREBASE_PRIVATE_KEY` is properly formatted with `\n` for line breaks
3. Verify `FIREBASE_STORAGE_BUCKET` matches your actual bucket name

## 🔧 **Troubleshooting**

If you continue to have issues:

1. Check that all environment variables are set correctly
2. Verify Firebase project permissions
3. Ensure Storage rules allow public read access for media files
4. Check browser console for specific error messages
