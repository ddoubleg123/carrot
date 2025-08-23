import { NextRequest, NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';
import { auth } from '@/auth';

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
    // Require authenticated user (NextAuth)
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { type, maxBytes } = await req.json();
    if (!type) return NextResponse.json({ error: 'Missing file type' }, { status: 400 });

    // Infer extension from MIME
    const ext = (type.split('/')?.[1] || 'bin').toLowerCase();
    // User-scoped object path
    const filename = `users/${userId}/uploads/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const file = storage.bucket(BUCKET!).file(filename);
    
    // Generate signed URL for upload
    // Add size guard via extension headers (V4) to limit content length server-side.
    // Default: 100 MB cap if not specified.
    const cap = typeof maxBytes === 'number' && maxBytes > 0 ? Math.floor(maxBytes) : 100 * 1024 * 1024;
    const [uploadURL] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 10 * 60 * 1000,
      contentType: type,
      extensionHeaders: {
        'x-goog-content-length-range': `1,${cap}`,
      },
    });
    
    // Generate signed URL for reading (valid for 24 hours)
    const [publicURL] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    });
    
    return NextResponse.json({ uploadURL, publicURL, objectPath: filename, maxBytes: cap });
  } catch (error) {
    console.error('[getPresignedURL] Error:', error);
    return NextResponse.json({ error: 'Failed to create presigned URL' }, { status: 500 });
  }
}
