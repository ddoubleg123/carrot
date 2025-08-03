import type { NextApiRequest, NextApiResponse } from 'next';
import { getStorage } from 'firebase-admin/storage';
import { app as firebaseAdminApp } from '@/lib/firebase-admin';
import { v4 as uuidv4 } from 'uuid';

// Ensure Firebase Admin is initialized
const storage = getStorage(firebaseAdminApp);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  // --- DEBUG LOGGING ---
  try {
    console.log('[getPresignedURL] Incoming request:', req.body);
    console.log('[getPresignedURL] ENV:', {
      FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
      FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
      FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY ? 'SET' : 'MISSING',
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
    const { type } = JSON.parse(req.body);
    if (!type) return res.status(400).json({ error: 'Missing file type' });

    // Generate unique file path
    const ext = type.split('/')[1] || 'bin';
    const fileName = `uploads/${uuidv4()}.${ext}`;
    const bucket = storage.bucket();

    // Get a signed URL for upload (PUT)
    const [uploadURL] = await bucket.file(fileName).getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 10 * 60 * 1000, // 10 minutes
      contentType: type,
    });
    const publicURL = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
    res.status(200).json({ uploadURL, publicURL });
  } catch (err: any) {
    console.error('[getPresignedURL] Error:', err);
    if (process.env.NODE_ENV !== 'production') {
      res.status(500).json({ error: 'Failed to get presigned URL', message: err.message, stack: err.stack });
    } else {
      res.status(500).json({ error: 'Failed to get presigned URL' });
    }
  }
}
