import { NextResponse } from 'next/server';
import { getStorage } from 'firebase-admin/storage';
import { initializeApp, getApps, cert } from 'firebase-admin/app';

// Initialize Firebase Admin if not already initialized
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });
}

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  context: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await context.params;
    const filePath = (path || []).join('/');
    console.log('[media] Serving file:', filePath);
    
    const bucket = getStorage().bucket();
    const file = bucket.file(filePath);
    
    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      console.log('[media] File not found:', filePath);
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
    
    // Get signed URL for the file
    const [signedUrl] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
    });
    
    console.log('[media] Redirecting to signed URL for:', filePath);
    
    // Redirect to signed URL
    return NextResponse.redirect(signedUrl, {
      status: 302,
      headers: {
        'Cache-Control': 'public, max-age=3600',
      },
    });
    
  } catch (error) {
    console.error('[media] Error serving file:', error);
    return NextResponse.json(
      { error: 'Failed to serve media' }, 
      { status: 500 }
    );
  }
}
