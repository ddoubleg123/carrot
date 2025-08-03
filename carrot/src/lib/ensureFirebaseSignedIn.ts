import { auth } from './firebase';
import type { Auth } from 'firebase/auth';
import { signInWithCustomToken } from 'firebase/auth';

export async function ensureFirebaseSignedIn() {
  if (!(auth as Auth).currentUser) {
    const res = await fetch('/api/firebase-custom-token');
    if (!res.ok) throw new Error('Failed to fetch Firebase custom token');
    const { token } = await res.json();
    await signInWithCustomToken(auth as Auth, token);
  }
}
