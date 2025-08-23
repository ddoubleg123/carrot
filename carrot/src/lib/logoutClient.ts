'use client';

import { signOut as nextAuthSignOut } from 'next-auth/react';
import { signOut as firebaseSignOut } from 'firebase/auth';
import { auth } from './firebase';

/**
 * Unified, fast client logout that clears Firebase auth and NextAuth session,
 * then redirects to /login.
 */
export async function logoutClient() {
  try {
    // Best-effort: sign out of Firebase quickly (doesn't block redirect if it fails)
    try {
      await firebaseSignOut(auth);
    } catch (e) {
      // Non-fatal; proceed with NextAuth sign out
      console.warn('[logoutClient] Firebase signOut failed (non-fatal):', e);
    }

    // Trigger NextAuth sign out with redirect handled for us
    await nextAuthSignOut({ callbackUrl: '/login' });
  } catch (err) {
    console.error('[logoutClient] Unexpected error during logout:', err);
    // Hard fallback if NextAuth fails to redirect
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }
}
