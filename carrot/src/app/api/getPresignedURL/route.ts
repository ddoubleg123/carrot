import { NextRequest, NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';

const storage = new Storage({
  projectId: process.env.FIREBASE_PROJECT_ID,
  credentials: {
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
});

const BUCKET = process.env.FIREBASE_STORAGE_BUCKET;

export async function POST(req: NextRequest) {
  try {
    const { type } = await req.json();
    if (!type) return NextResponse.json({ error: 'Missing file type' }, { status: 400 });
    const ext = type.split('/')[1] || 'bin';
    const filename = `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const file = storage.bucket(BUCKET!).file(filename);
    
    // Generate signed URL for upload
    const [uploadURL] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 10 * 60 * 1000,
      contentType: type,
    });
    
    // Generate signed URL for reading (valid for 24 hours)
    const [publicURL] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    });
    
    return NextResponse.json({ uploadURL, publicURL });
  } catch (error) {
    console.error('[getPresignedURL] Error:', error);
    return NextResponse.json({ error: 'Failed to create presigned URL' }, { status: 500 });
  }
}
