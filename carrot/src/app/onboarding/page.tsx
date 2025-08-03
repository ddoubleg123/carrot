'use server';

import { auth } from '@/auth';
import { redirect } from 'next/navigation';

import OnboardingClient from './OnboardingClient';

// Form data type for onboarding
type OnboardingData = {
  fullName: string;
  username: string;
  email: string;
  phone: string;
  country: string;
  zipCode: string;
  interests?: string;
  profilePhotoBlob?: Blob;
};

const TOTAL_STEPS = 4;

// Fade-in animation component props
interface FadeInProps {
  children: React.ReactNode;
  delay?: number;
}

// Fade-in animation component
const FadeIn = ({ children, delay = 0 }: FadeInProps) => (
  <div 
    className="animate-fadeIn" 
    style={{ 
      animationDelay: `${delay}ms`,
      opacity: 0,
      animationFillMode: 'forwards'
    }}
  >
    {children}
  </div>
);

import { TEST_USERS, ADMIN_USERS } from '@/config/auth';

import { PrismaClient } from '@prisma/client';

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

  // Fast-path: if user exists in DB, redirect to dashboard immediately (except TEST_USERS)
  if (!isTestUser && email) {
    const prisma = new PrismaClient();
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      redirect('/dashboard');
    }
  }

  // If already onboarded, redirect to dashboard
  if (isOnboarded) redirect('/dashboard');

  // Allow admins to bypass onboarding for /portal only (middleware handles this)
  // For all other users, require onboarding
  return <OnboardingClient session={session} />;
}

