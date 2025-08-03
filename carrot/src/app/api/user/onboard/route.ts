import { NextResponse } from 'next/server';
import { auth } from '../../../../auth';
import { db } from '../../../../lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

export async function POST() {
  try {
    const session = await auth();
    
    if (!session?.user?.email) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Reference to the user's document in Firestore
    const userRef = doc(db, 'users', session.user.email);
    
    // Update or create the user document with onboarding status
    await setDoc(userRef, 
      { 
        email: session.user.email,
        name: session.user.name,
        isOnboarded: true,
        updatedAt: new Date().toISOString()
      },
      { merge: true } // This will update existing fields or create the document if it doesn't exist
    );

    console.log('Updated onboarding status for user:', session.user.email);
    return NextResponse.json({ 
      success: true,
      userId: session.user.email,
      isOnboarded: true
    });
  } catch (error) {
    console.error('Error in onboarding API:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
