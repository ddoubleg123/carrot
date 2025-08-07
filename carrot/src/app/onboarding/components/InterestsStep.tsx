'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '../../../lib/utils';
import { useOnboardingSessionId } from '../useOnboardingSessionId';
import { useStagedOnboardingUpload } from '../useStagedOnboardingUpload';

interface InterestsStepProps {
  onNext: (data: { interests: string }) => void;
  onBack?: () => void;
  loading?: boolean;
  initialData?: { interests?: string };
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
  const [interests, setInterests] = useState(initialData.interests || '');
  const [isValid, setIsValid] = useState(false);
  const [showError, setShowError] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [showAgreementError, setShowAgreementError] = useState(false);

  // Validate interests input
  useEffect(() => {
    const valid = interests.length >= 10 && interests.length <= 100;
    setIsValid(valid);
    
    // Only show error message after the user has interacted with the input
    if (interests.length > 0) {
      setShowError(!valid);
    } else {
      setShowError(false);
    }
  }, [interests]);

  const sessionId = useOnboardingSessionId();
  // userId is now a required prop
  const { draft, finalizeOnboarding } = useStagedOnboardingUpload(sessionId, userId);
  const [draftError, setDraftError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDraftError(null);
    setShowAgreementError(false);
    if (!draft) {
      setDraftError('Please upload a profile photo before continuing.');
      return;
    }
    if (!draft.image || !draft.image.storagePath) {
      setDraftError('Profile photo upload incomplete. Please upload a photo before continuing.');
      return;
    }
    if (!agreed) {
      setShowAgreementError(true);
      return;
    }
    if (isValid) {
      try {
        await finalizeOnboarding();
        onNext({ interests });
      } catch (err: any) {
        setDraftError(err?.message || 'An unknown error occurred.');
      }
    }
  };


  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInterests(e.target.value);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {typeof currentStep === 'number' && typeof totalSteps === 'number' && (
        <div className="mb-2 text-xs text-gray-500 text-center font-medium">
          Step {currentStep} of {totalSteps}
        </div>
      )}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-center text-gray-900">
          What do you care about?
        </h2>
        {isFinalStep && (
          <p className="text-xs text-gray-500 mb-4">This is the final step.</p>
        )}
        
        <div className="space-y-2">
          <textarea
            id="interests"
            value={interests}
            onChange={handleChange}
            placeholder="e.g. sustainable energy, local art, vegan cooking"
            minLength={10}
            maxLength={100}
            rows={1}
            className={cn(
              "w-full px-4 py-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F47C23] focus:border-transparent transition-all resize-none",
              showError && "border-red-500 focus:ring-red-200"
            )}
            style={{ minHeight: '48px' }}
            required
          />
          
          <div className="flex justify-between items-center">
            <span className={cn(
              "text-xs",
              showError ? "text-red-500" : "text-gray-500"
            )}>
              {interests.length}/100 characters
            </span>
            
            {showError && (
              <span className="text-xs text-red-500">
                {interests.length < 10 
                  ? "Please enter at least 10 characters" 
                  : "Maximum 100 characters allowed"}
              </span>
            )}
          </div>
        </div>
      </div>
      
      {/* ToS/Privacy Agreement */}
      <div className="flex items-start mt-4">
        <input
          id="tos-agree"
          type="checkbox"
          checked={agreed}
          onChange={e => setAgreed(e.target.checked)}
          className="mt-1 mr-2 h-4 w-4 text-orange-500 border-gray-300 rounded focus:ring-orange-400"
        />
        <label htmlFor="tos-agree" className="text-xs text-gray-600 select-none">
          By signing up, you agree to our{' '}
          <a href="/terms" target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:text-primary-dark underline">Terms of Service</a>
          {' '}and{' '}
          <a href="/privacy" target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:text-primary-dark underline">Privacy Policy</a>.
        </label>
      </div>
      {showAgreementError && (
        <div className="text-xs text-red-500 mt-1">You must agree to the Terms of Service and Privacy Policy to continue.</div>
      )}

      <div className="mt-6 flex flex-col sm:flex-row gap-3">
        {onBack && (
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            className="w-full sm:w-auto"
            disabled={loading}
          >
            Back
          </Button>
        )}
        <Button
          type="submit"
          className={cn(
            "w-full sm:w-auto bg-orange-500 text-white hover:bg-orange-600",
            (!isValid || !draft || !draft.image || !draft.image.storagePath || !agreed) && "opacity-50 cursor-not-allowed"
          )}
          disabled={!isValid || loading || !draft || !draft.image || !draft.image.storagePath || !agreed}
        >
          {loading ? 'Processing...' : isFinalStep ? "I'm ready" : 'Continue'}
        </Button>
        {draftError && (
          <div className="mt-2 text-xs text-red-500 text-center">{draftError}</div>
        )}

      </div>
    </form>
  );
}
