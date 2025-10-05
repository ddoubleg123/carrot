import { useEffect } from 'react';
import { auth } from './firebase';
import { signInWithCustomToken } from 'firebase/auth';
import { createResilientFetch } from './retryUtils';

export function useSyncFirebaseAuth() {
  useEffect(() => {
    // Only run on client
    if (typeof window === 'undefined') return;
    // If already signed in, do nothing
    if (auth.currentUser) return;
    // Fetch and sign in with custom token using resilient fetch
    const resilientFetch = createResilientFetch();
    resilientFetch('/api/firebase-custom-token')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch Firebase custom token');
        return res.json();
      })
      .then(({ token }) => {
        if (!token) {
          // No token available (e.g., missing admin creds or signed-out) — skip silently
          return;
        }
        return signInWithCustomToken(auth, token);
      })
      .catch(err => {
        // Only log if not already signed in (avoid noise on logout)
        if (!auth.currentUser) {
          console.error('[useSyncFirebaseAuth] Failed to sync Firebase Auth:', err);
        }
      });
  }, []);
}
