import { getFunctions, httpsCallable } from 'firebase/functions';

/**
 * Calls the finalizeOnboardingSession Cloud Function.
 * @param sessionId The onboarding session ID to finalize.
 * @returns Result from the Cloud Function (photoURL, photoRev, etc)
 */
export async function finalizeOnboardingSession(sessionId: string) {
  const functions = getFunctions();
  const callable = httpsCallable(functions, 'finalizeOnboardingSession');
  return callable({ sessionId }).then(res => res.data);
}
