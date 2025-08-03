import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../auth';
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }
  // Use email as UID, or session.user.id if available
  const uid = session.user.id || session.user.email;
  try {
    const customToken = await admin.auth().createCustomToken(uid);
    return NextResponse.json({ token: customToken });
  } catch (e: any) {
    console.error('[firebase-custom-token] Error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
