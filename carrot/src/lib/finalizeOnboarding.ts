/**
 * Finalizes the onboarding session by calling the local API route.
 * @param sessionId The onboarding session ID to finalize.
 * @returns Result from the API call
 */
export async function finalizeOnboardingSession(sessionId: string) {
  console.log('[finalizeOnboardingSession] Finalizing onboarding with sessionId:', sessionId);
  
  const response = await fetch('/api/user/onboard', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sessionId }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[finalizeOnboardingSession] API error:', response.status, errorText);
    throw new Error(`Failed to finalize onboarding: ${response.status} ${errorText}`);
  }

  const result = await response.json();
  console.log('[finalizeOnboardingSession] Success:', result);
  return result;
}
