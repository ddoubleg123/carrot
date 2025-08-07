import { auth } from '@/auth';
import { redirect } from 'next/navigation';

import OnboardingClient from './OnboardingClient';

import { TEST_USERS, ADMIN_USERS } from '@/config/auth';

export default async function OnboardingPage() {
  const session = await auth();
  if (!session) redirect('/login?callbackUrl=/onboarding');

  const email = session.user?.email;
  const isTestUser = email && TEST_USERS.includes(email);
  const isAdmin = email && ADMIN_USERS.includes(email);
  const isOnboarded = session.user?.isOnboarded;

  // Always force onboarding for test users
  if (isTestUser) {
    // Never redirect to dashboard, always show onboarding
    return <OnboardingClient session={session} />;
  }

  // If already onboarded, redirect to dashboard
  if (isOnboarded) redirect('/dashboard');

  // Allow admins to bypass onboarding for /portal only (middleware handles this)
  // For all other users, require onboarding
  return <OnboardingClient session={session} />;
}

