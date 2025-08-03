'use client';

import Image from 'next/image';
import { PencilIcon, MapPinIcon, UserIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import EditProfileModal from './EditProfileModal';

type UserProfile = {
  id: string;
  name: string;
  username: string;
  email: string;
  phone?: string;
  avatar: string | null;
  banner: string | null;
  bio: string;
  location: string;
  joinDate: string;
  stats: {
    carrotsGiven: number;
    sticksGiven: number;
    followers: number;
    following: number;
  };
};

type ProfileHeaderProps = {
  user: UserProfile;
  isCurrentUser: boolean;
  onProfileUpdate?: (updatedProfile: Partial<UserProfile>) => void;
};

export default function ProfileHeader({ user, isCurrentUser, onProfileUpdate }: ProfileHeaderProps) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const handleSave = (updatedData: Partial<UserProfile>) => {
    if (onProfileUpdate) {
      onProfileUpdate(updatedData);
    }
    setIsEditModalOpen(false);
  };

  return (
    <div className="relative">
      {/* Banner Image */}
      <div className="h-48 bg-gradient-to-r from-primary/20 to-secondary/20 relative">
        {user.banner ? (
          <Image
            src={user.banner}
            alt="Banner"
            fill
            className="object-cover"
            priority
          />
        ) : (
          <div className="w-full h-full bg-gray-100" />
        )}
        
        {isCurrentUser && (
          <button 
            onClick={() => setIsEditModalOpen(true)}
            className="absolute top-4 right-4 bg-black/50 text-white p-2 rounded-full hover:bg-black/60 transition-colors"
            aria-label="Change cover photo"
          >
            <PencilIcon className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Profile Info */}
      <div className="px-6 pb-6 pt-4">
        <div className="flex justify-between items-start">
          <div className="-mt-16">
            <div className="h-32 w-32 rounded-full border-4 border-white bg-gray-100 flex items-center justify-center overflow-hidden relative">
              {user.avatar ? (
                <Image
                  src={user.avatar}
                  alt={user.name}
                  width={128}
                  height={128}
                  className="h-full w-full object-cover"
                />
              ) : (
                <UserIcon className="h-16 w-16 text-gray-400" />
              )}
              {isCurrentUser && (
                <button
                  onClick={() => setIsEditModalOpen(true)}
                  className="absolute -bottom-1 -right-1 bg-primary text-white p-2 rounded-full border-2 border-white hover:bg-primary/90 transition-colors"
                  aria-label="Edit profile picture"
                >
                  <PencilIcon className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {isCurrentUser && (
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="mt-6 px-5 py-2.5 bg-white border border-gray-200 rounded-full text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
            >
              Edit Profile
            </button>
          )}
        </div>

        <div className="mt-6">
          <h1 className="text-2xl font-bold text-gray-900">{user.name}</h1>
          <p className="text-gray-500 mt-1">@{user.username}</p>
          
          {user.bio && (
            <p className="mt-4 text-gray-700 leading-relaxed">{user.bio}</p>
          )}
          
          <div className="mt-4 flex items-center text-sm text-gray-500 space-x-4">
            {user.location && (
              <div className="flex items-center">
                <MapPinIcon className="h-4 w-4 mr-1.5 text-gray-400" />
                <span>{user.location}</span>
              </div>
            )}
            {user.joinDate && (
              <div className="flex items-center">
                <span>Joined {new Date(user.joinDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-y-3 gap-x-6">
            <div className="flex items-center">
              <span className="font-semibold text-gray-900">{user.stats.following.toLocaleString()}</span>
              <span className="ml-1.5 text-gray-600 text-sm">Following</span>
            </div>
            <div className="flex items-center">
              <span className="font-semibold text-gray-900">{user.stats.followers.toLocaleString()}</span>
              <span className="ml-1.5 text-gray-600 text-sm">Followers</span>
            </div>
            <div className="flex items-center">
              <span className="font-semibold text-gray-900">{user.stats.carrotsGiven.toLocaleString()}</span>
              <span className="ml-1.5 text-gray-600 text-sm">Carrots</span>
            </div>
            <div className="flex items-center">
              <span className="font-semibold text-gray-900">{user.stats.sticksGiven.toLocaleString()}</span>
              <span className="ml-1.5 text-gray-600 text-sm">Sticks</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
