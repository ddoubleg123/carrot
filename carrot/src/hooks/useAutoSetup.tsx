'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

// Hook to automatically setup user data for danielgouldman@gmail.com to skip onboarding
export function useAutoSetup() {
  const { data: session, status } = useSession();
  const [isAutoSetupComplete, setIsAutoSetupComplete] = useState(false);
  const [isAutoSetupLoading, setIsAutoSetupLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Only run auto-setup for danielgouldman@gmail.com when authenticated
    if (
      status === 'authenticated' && 
      session?.user?.email === 'danielgouldman@gmail.com' &&
      !isAutoSetupComplete &&
      !isAutoSetupLoading
    ) {
      performAutoSetup();
    }
  }, [status, session, isAutoSetupComplete, isAutoSetupLoading]);

  const performAutoSetup = async () => {
    setIsAutoSetupLoading(true);
    
    try {
      console.log('[useAutoSetup] Auto-setting up user:', session?.user?.email);
      
      const response = await fetch('/api/user/auto-setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        console.log('[useAutoSetup] Auto-setup result:', result);
        
        if (result.success && !result.requiresOnboarding) {
          setIsAutoSetupComplete(true);
          console.log('[useAutoSetup] User auto-setup completed, redirecting to home');
          
          // Redirect to home since onboarding is not needed
          router.push('/home');
        } else {
          console.log('[useAutoSetup] User requires onboarding');
        }
      } else {
        console.warn('[useAutoSetup] Auto-setup failed:', response.status);
      }
    } catch (error) {
      console.error('[useAutoSetup] Auto-setup error:', error);
    } finally {
      setIsAutoSetupLoading(false);
    }
  };

  return {
    isAutoSetupComplete,
    isAutoSetupLoading,
    shouldSkipOnboarding: isAutoSetupComplete && session?.user?.email === 'danielgouldman@gmail.com'
  };
}
