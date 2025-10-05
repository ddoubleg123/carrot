import { auth } from './firebase';
import type { Auth } from 'firebase/auth';
import { signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { createResilientFetch } from './retryUtils';

export async function ensureFirebaseSignedIn() {
  console.log('[ensureFirebaseSignedIn] Current Firebase user:', (auth as Auth).currentUser?.uid);
  
  if (!(auth as Auth).currentUser) {
    console.log('[ensureFirebaseSignedIn] No Firebase user, fetching custom token...');
    
    const resilientFetch = createResilientFetch();
    const res = await resilientFetch('/api/firebase-custom-token');
    console.log('[ensureFirebaseSignedIn] Custom token response:', res.status, res.statusText);
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error('[ensureFirebaseSignedIn] Failed to fetch custom token:', errorText);
      throw new Error(`Failed to fetch Firebase custom token: ${res.status} ${errorText}`);
    }
    
    const data = await res.json().catch(() => ({ token: null as string | null }));
    const token = (data as any)?.token as string | null | undefined;
    if (!token) {
      console.warn('[ensureFirebaseSignedIn] No custom token returned (likely missing admin creds or no session). Skipping Firebase sign-in.');
      return; // avoid calling signInWithCustomToken with undefined and causing auth/internal-error
    }
    console.log('[ensureFirebaseSignedIn] Got custom token, signing in to Firebase...');
    
    // Sign in with custom token
    let userCredential;
    try {
      userCredential = await signInWithCustomToken(auth as Auth, token);
      console.log('[ensureFirebaseSignedIn] signInWithCustomToken completed, user:', userCredential.user.uid);
    } catch (e: any) {
      console.error('[ensureFirebaseSignedIn] signInWithCustomToken failed:', {
        name: e?.name,
        code: e?.code,
        message: e?.message,
      });
      // Do not throw to avoid breaking UI flows; let caller continue unauthenticated
      return;
    }
    
    // Wait for auth state to propagate to Firestore client
    console.log('[ensureFirebaseSignedIn] Waiting for auth state to propagate...');
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        unsubscribe();
        reject(new Error('Timeout waiting for Firebase auth state to propagate'));
      }, 10000); // 10 second timeout
      
      const unsubscribe = onAuthStateChanged(auth as Auth, (user) => {
        if (user && user.uid === userCredential.user.uid) {
          console.log('[ensureFirebaseSignedIn] Auth state propagated, user ready:', user.uid);
          clearTimeout(timeout);
          unsubscribe();
          resolve();
        }
      });
    });
    
    console.log('[ensureFirebaseSignedIn] Successfully signed in to Firebase:', (auth as Auth).currentUser?.uid);
  } else {
    console.log('[ensureFirebaseSignedIn] Already signed in to Firebase:', (auth as Auth).currentUser?.uid);
  }
}
