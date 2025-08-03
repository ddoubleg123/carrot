import { useEffect, useState } from "react";

// Generates or retrieves a persistent onboarding session ID (UUID) for the current user onboarding flow
export function useOnboardingSessionId(): string {
  const [sessionId, setSessionId] = useState<string>("");

  useEffect(() => {
    let stored = localStorage.getItem("carrot_onboarding_session_id");
    if (!stored) {
      stored = crypto.randomUUID();
      localStorage.setItem("carrot_onboarding_session_id", stored);
    }
    setSessionId(stored);
  }, []);

  return sessionId;
}

// Utility to reset session ID if onboarding restarts
export function resetOnboardingSessionId() {
  localStorage.removeItem("carrot_onboarding_session_id");
}
