import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../auth';
import * as admin from 'firebase-admin';

// Detect presence of required admin credentials once
const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
const hasAdminCreds = Boolean(
  PROJECT_ID &&
  process.env.FIREBASE_CLIENT_EMAIL &&
  process.env.FIREBASE_PRIVATE_KEY
);

if (hasAdminCreds && !admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  } catch (e) {
    console.error('[firebase-admin] initializeApp failed:', e);
  }
}

export async function GET(req: NextRequest) {
  // If admin credentials are not configured, return a safe no-op so client can skip
  if (!hasAdminCreds) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[firebase-custom-token] Admin credentials missing; returning null token.');
    }
    return NextResponse.json({ token: null });
  }

  const session = await auth();
  if (!session?.user?.email) {
    // Return 200 with null token to avoid noisy client errors during signed-out states
    return NextResponse.json({ token: null });
  }
  // Use email as UID, or session.user.id if available
  const uid = (session.user as any).id || session.user.email;
  try {
    const customToken = await admin.auth().createCustomToken(uid);
    return NextResponse.json({ token: customToken });
  } catch (e: any) {
    console.error('[firebase-custom-token] Error creating custom token:', e);
    // Do not break the app flow; return null token
    return NextResponse.json({ token: null });
  }
}
