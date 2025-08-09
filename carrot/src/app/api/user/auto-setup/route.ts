import { NextResponse } from 'next/server';
import { auth } from '../../../../auth';
import { app } from '../../../../lib/firebase-admin';
import * as admin from 'firebase-admin';
const db = admin.firestore(app);

// Pre-configured user data for danielgouldman@gmail.com to skip onboarding
const PRECONFIGURED_USERS = {
  'danielgouldman@gmail.com': {
    email: 'danielgouldman@gmail.com',
    name: 'Daniel Gouldman',
    username: 'danielgouldman',
    profilePhoto: 'https://lh3.googleusercontent.com/a/default-user', // Default or actual photo URL
    isOnboarded: true,
    onboardedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    // Add any other fields you want pre-configured
    bio: 'Developer and creator',
    location: 'San Francisco, CA',
    website: 'https://danielgouldman.com'
  }
};

export async function POST(request: Request) {
  let session;
  let requestBody: any = {};
  
  try {
    // Try to get request body for email if provided
    try {
      requestBody = await request.json();
    } catch {
      // No body provided, continue with session-based auth
    }

    session = await auth();
    
    if (!session?.user?.id || !session?.user?.email) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const userEmail = requestBody.email || session.user.email;
    console.log('[auto-setup API] Checking auto-setup for user:', userEmail);

    // Check if this user has pre-configured data
    if (!PRECONFIGURED_USERS[userEmail as keyof typeof PRECONFIGURED_USERS]) {
      return NextResponse.json({ 
        success: false, 
        message: 'No pre-configured data for this user',
        requiresOnboarding: true
      });
    }

    // Get pre-configured data for this user
    const preConfiguredData = PRECONFIGURED_USERS[userEmail as keyof typeof PRECONFIGURED_USERS];
    
    // Reference to the user's document in Firestore
    const userRef = db.collection('users').doc(session.user.id);
    
    // Check if user already exists and is onboarded
    const userDoc = await userRef.get();
    if (userDoc.exists && userDoc.data()?.isOnboarded) {
      console.log('[auto-setup API] User already onboarded:', userEmail);
      return NextResponse.json({ 
        success: true, 
        message: 'User already onboarded',
        requiresOnboarding: false,
        userData: userDoc.data()
      });
    }

    // Prepare user data with the user's actual ID
    const userData = {
      ...preConfiguredData,
      id: session.user.id,
      updatedAt: new Date().toISOString()
    };

    console.log('[auto-setup API] Auto-setting up user data for:', userEmail);
    console.log('[auto-setup API] User data:', userData);

    // Create/update the user document with pre-configured data
    await userRef.set(userData, { merge: true });

    console.log('[auto-setup API] Successfully auto-setup user:', userEmail);
    
    return NextResponse.json({ 
      success: true,
      message: 'User auto-setup completed',
      requiresOnboarding: false,
      userData: userData
    });

  } catch (error) {
    console.error('[auto-setup API] Error in auto-setup:', error);
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
