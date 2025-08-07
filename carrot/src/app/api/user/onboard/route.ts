import { NextResponse } from 'next/server';
import { auth } from '../../../../auth';
import { app } from '../../../../lib/firebase-admin';
const admin = require('firebase-admin');
const db = admin.firestore(app);

export async function POST(request: Request) {
  let session;
  let sessionId: string | undefined;
  
  try {
    session = await auth();
    
    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Get the sessionId from the request body (optional)
    try {
      const body = await request.json();
      sessionId = body.sessionId;
    } catch {
      // Body parsing failed, continue without sessionId
    }

    console.log('[onboard API] Finalizing onboarding for user:', session.user.id, 'sessionId:', sessionId);

    // Reference to the user's document in Firestore using Firebase Admin SDK
    const userRef = db.collection('users').doc(session.user.id);
    
    // Prepare user data, filtering out undefined values
    const userData: any = {
      id: session.user.id,
      isOnboarded: true,
      onboardedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Only add fields that are not undefined
    if (session.user.email !== undefined) userData.email = session.user.email;
    if (session.user.username !== undefined) userData.username = session.user.username;
    if (session.user.name !== undefined) userData.name = session.user.name;
    if (session.user.profilePhoto !== undefined) userData.profilePhoto = session.user.profilePhoto;

    console.log('[onboard API] Saving user data:', userData);

    // Update or create the user document with onboarding status and user data
    await userRef.set(userData, { merge: true });

    console.log('[onboard API] Successfully updated onboarding status for user:', session.user.id);
    return NextResponse.json({ 
      success: true,
      userId: session.user.id,
      isOnboarded: true,
      profilePhoto: session.user.profilePhoto
    });
  } catch (error) {
    console.error('[onboard API] Error in onboarding API:', error);
    console.error('[onboard API] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      userId: session?.user?.id || 'unknown',
      sessionId: sessionId || 'unknown'
    });
    return new NextResponse(
      JSON.stringify({ 
        error: 'Internal Server Error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }), 
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
