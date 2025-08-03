'use client';

import { useState, useEffect } from 'react';
import { FaGoogle, FaMicrosoft, FaMobileAlt, FaLink, FaApple } from 'react-icons/fa';
import { computeChannelOrder, getChannelDisplayName, getChannelDescription, getChannelIcon } from '@/utils/channelUtils';
import { useOnboardingSessionId } from '../useOnboardingSessionId';
import { useStagedOnboardingUpload } from '../useStagedOnboardingUpload';

interface InviteOption {
  id: string;
  label: string;
  icon: React.ReactNode;
  checked: boolean;
  description: string;
  channel: 'gmail' | 'outlook' | 'phone' | 'apple' | 'share';
}

interface TellYourFriendsStepProps {
  onNext: (data: { inviteChannels: string[] }) => void;
  onBack: () => void;
  loading?: boolean;
  currentStep: number;
  totalSteps: number;
  email?: string;
}

export default function TellYourFriendsStep({
  onNext,
  onBack,
  loading = false,
  currentStep = 2,
  totalSteps = 3,
  email = '', // User's email for domain detection
  userId,
}: TellYourFriendsStepProps & { email?: string, userId: string }) {
  const [inviteOptions, setInviteOptions] = useState<InviteOption[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [firstRender, setFirstRender] = useState(true);

  // Initialize options based on user's email and platform
  useEffect(() => {
    // Only run on client-side
    setIsClient(true);
    
    if (!email && isClient) {
      // Try to get email from session or local storage if not provided
      const sessionEmail = localStorage.getItem('userEmail') || '';
      email = sessionEmail;
    }

    // If still no email, use a default
    const userEmail = email || 'user@example.com';
    const userAgent = typeof window !== 'undefined' ? window.navigator.userAgent : '';
    
    // Get ordered channels based on email domain and platform
    const orderedChannels = computeChannelOrder(userEmail, userAgent);
    
    // Create options with the new order
    const options = orderedChannels.map(channel => ({
      id: channel,
      label: getChannelDisplayName(channel),
      icon: getChannelIcon(channel, 'text-lg'),
      checked: true, // All options start checked
      description: getChannelDescription(channel),
      channel: channel as 'gmail' | 'outlook' | 'phone' | 'apple' | 'share'
    }));
    
    setInviteOptions(options);
    setFirstRender(false);
  }, [email]); // Re-run if email changes

  const toggleOption = (id: string) => {
    setInviteOptions(prevOptions =>
      prevOptions.map(option =>
        option.id === id ? { ...option, checked: !option.checked } : option
      )
    );
  };

  // Track first action for analytics
  const trackFirstAction = (channel: string) => {
    // Only track the first action
    if (firstRender) {
      console.log(`First invite action: ${channel}`);
      // In a real app, you would send this to your analytics service
      // analytics.track('invite_first_action', { channel });
      setFirstRender(false);
    }
  };

  // Onboarding session and staged upload hook
  const sessionId = useOnboardingSessionId();
  const { saveDraft } = useStagedOnboardingUpload(sessionId, userId);

  // Handle next button click
  const handleNext = async () => {
    // Only proceed if at least one channel is selected
    if (inviteOptions.some(option => option.checked)) {
      const selectedChannels = inviteOptions
        .filter(option => option.checked)
        .map(option => option.id);
      // Save to Firestore draft before proceeding
      await saveDraft({ data: { inviteChannels: selectedChannels }, step: 2 });
      onNext({ inviteChannels: selectedChannels });
    }
  };

  // Check if at least one channel is selected
  const isNextDisabled = !inviteOptions.some(option => option.checked);

  const progressPercentage = Math.round((currentStep / totalSteps) * 100);
  
  // Don't render until we have options (client-side only)
  if (!isClient || inviteOptions.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-pulse">Loading invite options...</div>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      handleNext();
    }} className="space-y-6">
      <h2 className="text-2xl font-bold text-center text-gray-900 mb-2 pt-2">Share Carrot with Friends</h2>
      <p className="text-gray-600">
        Invite your friends to join Carrot and earn rewards together.
      </p>
      
      {/* Invite Options */}
      <div className="space-y-4">
        {inviteOptions.map((option, index) => {
          // Highlight the first option
          const isFirst = index === 0;
          
          return (
            <div 
              key={option.id} 
              role="checkbox"
              aria-checked={option.checked}
              tabIndex={0}
              className={`relative flex items-start p-4 rounded-lg transition-all cursor-pointer ${
                option.checked 
                  ? 'border-2 border-orange-500 bg-orange-50' 
                  : 'border border-gray-300 hover:bg-slate-50'
              } ${isFirst ? 'ring-2 ring-offset-2 ring-orange-200' : ''}`}
              onClick={(e) => {
                e.preventDefault();
                toggleOption(option.id);
                trackFirstAction(option.channel);
              }}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  toggleOption(option.id);
                  trackFirstAction(option.channel);
                }
              }}
            >
              <div className="flex items-center h-5">
                <div className={`flex items-center justify-center h-5 w-5 rounded ${
                  option.checked 
                    ? 'bg-orange-500 text-white' 
                    : 'border-2 border-gray-300 bg-white'
                }`}>
                  {option.checked && (
                    <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <input
                  id={option.id}
                  name={option.id}
                  type="checkbox"
                  checked={option.checked}
                  onChange={(e) => {
                    e.stopPropagation();
                    toggleOption(option.id);
                    trackFirstAction(option.channel);
                  }}
                  className="sr-only"
                  aria-describedby={`${option.id}-description`}
                  aria-label={option.description}
                />
              </div>
              <div className="ml-3 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`${option.checked ? 'text-orange-700' : 'text-gray-700'}`}>
                    {option.icon}
                  </span>
                  <span className={`font-medium ${option.checked ? 'text-orange-700' : 'text-gray-700'}`}>
                    {option.label}
                  </span>
                </div>
                <p id={`${option.id}-description`} className={`text-xs mt-1 ${
                  option.checked ? 'text-orange-600' : 'text-gray-500'
                }`}>
                  {option.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Token Reward Reminder */}
      <p className="text-sm text-gray-500">
        You'll earn 1 Carrot token for every friend who joins.
      </p>

      {/* Navigation Buttons */}
      <div className="mt-8 flex justify-between">
        <button
          type="button"
          onClick={onBack}
          disabled={loading}
          className="px-6 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#F47C23] disabled:opacity-50"
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleNext}
          disabled={loading || isNextDisabled}
          className={`px-6 py-2.5 font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#F47C23] ${
            isNextDisabled 
              ? 'bg-gray-200 text-gray-500 cursor-not-allowed opacity-50' 
              : 'bg-[#F47C23] text-white hover:bg-[#E06D1D]'
          }`}
        >
          {loading ? 'Loading...' : 'Next'}
        </button>
      </div>
    </form>
  );
}
