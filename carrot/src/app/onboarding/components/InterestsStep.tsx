'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '../../../lib/utils';
import { useOnboardingSessionId } from '../useOnboardingSessionId';
import { useStagedOnboardingUpload } from '../useStagedOnboardingUpload';
import InterestPicker from '@/components/interests/InterestPicker';
import type { InterestPick } from '@/lib/interestCatalog';

interface InterestsStepProps {
  onNext: (data: { interests: string; interestPicks: InterestPick[] }) => void;
  onBack?: () => void;
  loading?: boolean;
  initialData?: { interests?: string; interestPicks?: InterestPick[] };
  isFinalStep?: boolean;
  currentStep?: number;
  totalSteps?: number;
  userId: string;
}

export function InterestsStep({
  onNext,
  onBack,
  loading = false,
  initialData = {},
  isFinalStep = false,
  currentStep,
  totalSteps,
  userId
}: InterestsStepProps) {
  const [picks, setPicks] = useState<InterestPick[]>(initialData.interestPicks || []);
  const [agreed, setAgreed] = useState(false);
  const [showAgreementError, setShowAgreementError] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const sessionId = useOnboardingSessionId();
  const { draft, finalizeOnboarding } = useStagedOnboardingUpload(sessionId, userId);
  const ready = picks.length >= 3;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDraftError(null);
    setShowAgreementError(false);
    if (!draft?.image?.storagePath) {
      setDraftError('Please upload a profile photo before continuing.');
      return;
    }
    if (!agreed) {
      setShowAgreementError(true);
      return;
    }
    if (!ready) return;
    try {
      await finalizeOnboarding();
      onNext({
        interests: picks.map((pick) => pick.label).join(', ').slice(0, 255),
        interestPicks: picks
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unknown error occurred.';
      setDraftError(message);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {typeof currentStep === 'number' && typeof totalSteps === 'number' && (
        <div className="mb-2 text-center text-xs font-medium text-gray-500">
          Step {currentStep} of {totalSteps}
        </div>
      )}
      <div className="space-y-3">
        <h2 className="text-center text-xl font-semibold text-gray-900">What do you care about?</h2>
        <p className="text-center text-xs text-gray-500">Pick at least three. Search the list, or write a sentence and we will sort it.</p>
        <InterestPicker initial={initialData.interestPicks} onChange={setPicks} />
      </div>
      <div className="mt-4 flex items-start">
        <input
          id="tos-agree"
          type="checkbox"
          checked={agreed}
          onChange={e => setAgreed(e.target.checked)}
          className="mr-2 mt-1 h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-400"
        />
        <label htmlFor="tos-agree" className="select-none text-xs text-gray-600">
          By signing up, you agree to our{' '}
          <a href="/terms" target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline hover:text-primary-dark">Terms of Service</a>
          {' '}and{' '}
          <a href="/privacy" target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline hover:text-primary-dark">Privacy Policy</a>.
        </label>
      </div>
      {showAgreementError && (
        <div className="mt-1 text-xs text-red-500">You must agree to the Terms of Service and Privacy Policy to continue.</div>
      )}
      <div className="mt-8 flex flex-col gap-4 sm:flex-row">
        {onBack && (
          <Button type="button" variant="outline" onClick={onBack} className="w-full rounded-lg px-6 py-3 text-sm font-semibold sm:w-auto" disabled={loading}>
            Back
          </Button>
        )}
        <Button
          type="submit"
          className={cn(
            "w-full rounded-lg px-6 py-3 text-sm font-semibold sm:w-auto",
            (!ready || !draft?.image?.storagePath || !agreed)
              ? "cursor-not-allowed bg-gray-200 text-gray-400"
              : "bg-gradient-to-r from-orange-500 to-orange-600 text-white"
          )}
          disabled={!ready || loading || !draft?.image?.storagePath || !agreed}
        >
          {loading ? 'Processing...' : isFinalStep ? "I'm ready" : 'Continue'}
        </Button>
        {draftError && <div className="mt-2 text-center text-xs text-red-500">{draftError}</div>}
      </div>
    </form>
  );
}
