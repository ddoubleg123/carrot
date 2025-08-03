"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import PersonalInfoStep from "./components/PersonalInfoStep";
import TellYourFriendsStep from "./components/TellYourFriendsStep";
import { InterestsStep } from "./components/InterestsStep";
import StepperBar from "./components/StepperBar";
import OnboardingSurveyStep from "./components/OnboardingSurveyStep";

// Accept session as prop from server component
export default function OnboardingClient({ session }: { session: any }) {
  if (typeof window !== 'undefined') {
    console.log('[OnboardingClient] session:', session);
    if (session?.user) {
      console.log('[OnboardingClient] session.user:', session.user);
      Object.entries(session.user).forEach(([key, value]) => {
        console.log(`[OnboardingClient] session.user.${key}:`, value);
      });
    }
  }
  // Runtime assertion for debugging
  const email = session?.user?.email;
  if (!email || typeof email !== 'string' || email.trim() === '') {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen p-8">
        <div className="bg-red-100 text-red-700 p-4 rounded-lg shadow mb-4">
          <b>Onboarding Error:</b> Your session is missing an email address.<br/>
          This usually means your Google account or database record does not have an email, or the NextAuth callback is not setting it correctly.<br/>
          Please contact support or try logging in again.<br/>
          <b>Debug: email value =</b> <span className="font-mono bg-yellow-50 px-2 py-1 rounded">{String(email)}</span>
          <pre className="mt-4 text-xs bg-red-50 p-2 rounded overflow-x-auto">
            {JSON.stringify(session, null, 2)}
          </pre>
        </div>
      </main>
    );
  }
  // Move onboarding state and logic here
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<any>({});
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const TOTAL_STEPS = 3;

  // Render original 3-step onboarding flow
  function handleNextStep(data: any) {
    setFormData((prev: any) => ({ ...prev, ...data }));
    setStep((prev) => prev + 1);
  }
  function handleBackStep() {
    setStep((prev) => prev - 1);
  }
  async function handleFinish(data: any) {
    const allData = { ...formData, ...data };
    setFormData(allData);
    try {
      const res = await fetch('/api/user/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(allData),
      });
      if (!res.ok) {
        const err = await res.text();
        alert('Failed to save onboarding data: ' + err);
        return;
      }
    } catch (err: any) {
      alert('Failed to save onboarding data: ' + err?.message || err);
      return;
    }
    window.location.href = "/dashboard";
  }
  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-white to-[#f7faff] p-4">
      {/* Carrot Logo Above Rectangle */}
      <div className="flex flex-col items-center mb-2">
        <div className="relative">
          <div className="rounded-full blur-2xl bg-orange-200 opacity-60 animate-pulse w-16 h-16 absolute top-0 left-0 right-0 bottom-0 m-auto" style={{ zIndex: 0 }} />
          <img src="/carrot-logo.png" alt="Carrot Logo" className="h-16 w-16 mx-auto mb-4" style={{ filter: 'drop-shadow(0 0 16px #f47c23cc)' }} />
        </div>
      </div>
      <StepperBar currentStep={step} totalSteps={TOTAL_STEPS} />
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8" style={{ paddingTop: 24 }}>
        {step === 1 && (
          <PersonalInfoStep
            email={session?.user?.email || ''}
            userId={session?.user?.id || ''}
            onNext={handleNextStep}
            initialData={{ ...formData, email: session?.user?.email || '', userId: session?.user?.id || '' }}
            loading={false}
          />
        )}
        {step === 2 && (
          <TellYourFriendsStep
            onNext={handleNextStep}
            onBack={handleBackStep}
            loading={false}
            currentStep={2}
            totalSteps={TOTAL_STEPS}
            email={session?.user?.email}
            userId={session?.user?.id}
          />
        )}
        {step === 3 && (
          <InterestsStep
            onNext={handleFinish}
            onBack={handleBackStep}
            loading={false}
            initialData={formData}
            isFinalStep={true}
            currentStep={3}
            totalSteps={TOTAL_STEPS}
            userId={session?.user?.id}
          />
        )}
      </div>
    </main>
  );
}
