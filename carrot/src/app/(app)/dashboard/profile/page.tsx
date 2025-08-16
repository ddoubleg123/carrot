'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import dynamic from 'next/dynamic';
import type { UserProfile, UserStats } from './types';

// Dynamically import components with no SSR
const ProfileHeader = dynamic(
  () => import('./components/ProfileHeader'), 
  { ssr: false }
);

const ProfileTabs = dynamic(
  () => import('./components/ProfileTabs'), 
  { 
    ssr: false,
    loading: () => <div className="h-16 bg-gray-100 rounded-lg animate-pulse" />
  }
);

export default function ProfilePage() {
  const { data: session, status, update: updateSession } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  // Load or update profile data
  const loadProfileData = useCallback(async () => {
    if (status === 'authenticated' && session?.user) {
      try {
        // In a real app, this would be an API call to fetch the user's profile
        const profileData: UserProfile = {
          id: session.user.email ?? 'unknown', // Use email as fallback ID since session.user.id doesn't exist in standard NextAuth
          name: session.user.name || 'Anonymous User',
          username: session.user.email?.split('@')[0] || 'anonymous',
          email: session.user.email || '',
          avatar: session.user.image || null,
          banner: null, // Default banner
          bio: 'Passionate about making a difference in my community. Building a better future, one commitment at a time! 🌱',
          location: 'San Francisco, CA',
          joinDate: `Joined ${new Date().toLocaleString('default', { month: 'long' })} ${new Date().getFullYear()}`,
          stats: {
            carrotsGiven: 42,
            sticksGiven: 7,
            followers: 128,
            following: 64,
          },
          isCurrentUser: true,
        };
        
        setUserProfile(profileData);
        setError(null);
      } catch (err) {
        console.error('Error loading profile:', err);
        setError('Failed to load profile data. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }
  }, [session, status]);

  // Handle profile updates
  const handleProfileUpdate = useCallback(async (updatedData: Partial<UserProfile>) => {
    try {
      // In a real app, this would be an API call to update the profile
      console.log('Updating profile with:', updatedData);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Update local state with proper typing
      setUserProfile((prev: UserProfile | null): UserProfile | null => {
        if (!prev) return null;
        return { ...prev, ...updatedData } as UserProfile;
      });
      
      // If the name or image was updated, update the session
      if (updatedData.name || updatedData.avatar) {
        await updateSession({
          ...session,
          user: {
            ...session?.user,
            name: updatedData.name || session?.user?.name,
            image: updatedData.avatar || session?.user?.image,
          },
        });
      }
      
      return true;
    } catch (err) {
      console.error('Error updating profile:', err);
      return false;
    }
  }, [session, updateSession]);

  // Load profile data on mount and when session changes
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }
    
    if (status === 'authenticated') {
      loadProfileData();
    }
  }, [status, router, loadProfileData]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your profile...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center p-6 max-w-md w-full bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Something went wrong</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // No profile data
  if (!userProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <p className="text-gray-600">No profile data available.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full pl-0">
      {/* Profile Header */}
      <div className="mb-6 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {userProfile && (
          <ProfileHeader 
            user={userProfile}
            isCurrentUser={userProfile.isCurrentUser}
            onProfileUpdate={handleProfileUpdate}
          />
        )}
      </div>
      
      {/* Profile Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {userProfile && (
          <div className="px-6 pt-4">
            <ProfileTabs 
              userId={userProfile.id}
              stats={userProfile.stats}
              isCurrentUser={userProfile.isCurrentUser}
            />
          </div>
        )}
      </div>
    </div>
  );
}
