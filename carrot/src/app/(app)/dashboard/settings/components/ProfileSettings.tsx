'use client';

import { useState, useRef, ChangeEvent } from 'react';
import { UserIcon, PhotoIcon } from '@heroicons/react/24/outline';

interface ProfileSettingsProps {
  formData: {
    displayName: string;
    bio: string;
    location: string;
  };
  onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onImageChange: (type: 'avatar' | 'banner', file: File) => void;
}

export default function ProfileSettings({ formData, onInputChange, onImageChange }: ProfileSettingsProps) {
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>, type: 'avatar' | 'banner') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      if (type === 'avatar') {
        setAvatarPreview(result);
      } else {
        setBannerPreview(result);
      }
      onImageChange(type, file);
    };
    reader.readAsDataURL(file);
  };

  const triggerFileInput = (ref: React.RefObject<HTMLInputElement>) => {
    ref.current?.click();
  };

  return (
    <div className="bg-white shadow-sm rounded-lg p-6">
      <h2 className="text-lg font-medium text-gray-900 mb-6">Profile Settings</h2>
      
      <div className="space-y-6">
        {/* Profile Image */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Profile Image
          </label>
          <div className="flex items-center">
            <div className="relative">
              <div className="h-24 w-24 rounded-full bg-gray-100 overflow-hidden">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="Profile preview"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-gray-400">
                    <UserIcon className="h-12 w-12" />
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => triggerFileInput(avatarInputRef)}
                className="absolute -bottom-1 -right-1 bg-white p-1.5 rounded-full border border-gray-300 shadow-sm hover:bg-gray-50"
              >
                <PhotoIcon className="h-4 w-4 text-gray-700" />
                <span className="sr-only">Upload profile image</span>
              </button>
              <input
                type="file"
                ref={avatarInputRef}
                className="hidden"
                accept="image/*"
                onChange={(e) => handleImageUpload(e, 'avatar')}
              />
            </div>
            <div className="ml-4">
              <button
                type="button"
                onClick={() => triggerFileInput(avatarInputRef)}
                className="text-sm font-medium text-primary-600 hover:text-primary-500"
              >
                Upload new photo
              </button>
              <p className="mt-1 text-xs text-gray-500">
                JPG, GIF or PNG. Max size 2MB
              </p>
            </div>
          </div>
        </div>

        {/* Cover Image */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Cover Image
          </label>
          <div 
            className="h-48 bg-gray-100 rounded-lg overflow-hidden relative group cursor-pointer"
            onClick={() => triggerFileInput(bannerInputRef)}
          >
            {bannerPreview ? (
              <img
                src={bannerPreview}
                alt="Cover preview"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full flex flex-col items-center justify-center text-gray-400">
                <PhotoIcon className="h-10 w-10 mb-2" />
                <span className="text-sm">Add cover image</span>
              </div>
            )}
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center">
              <span className="text-white text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                {bannerPreview ? 'Change cover' : 'Add cover'}
              </span>
            </div>
            <input
              type="file"
              ref={bannerInputRef}
              className="hidden"
              accept="image/*"
              onChange={(e) => handleImageUpload(e, 'banner')}
            />
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Recommended size: 1500x500px, max 5MB
          </p>
        </div>

        {/* Display Name */}
        <div>
          <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-1">
            Display Name
          </label>
          <input
            type="text"
            id="displayName"
            name="displayName"
            value={formData.displayName}
            onChange={onInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
          />
          <p className="mt-1 text-xs text-gray-500">
            Your name as it appears on your profile
          </p>
        </div>

        {/* Bio */}
        <div>
          <label htmlFor="bio" className="block text-sm font-medium text-gray-700 mb-1">
            Bio
          </label>
          <div className="mt-1">
            <textarea
              id="bio"
              name="bio"
              rows={3}
              value={formData.bio}
              onChange={onInputChange}
              className="shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full border border-gray-300 rounded-md"
              placeholder="Tell others about yourself..."
              maxLength={160}
            />
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {formData.bio.length}/160 characters
          </p>
        </div>

        {/* Location */}
        <div>
          <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
            Location
          </label>
          <input
            type="text"
            id="location"
            name="location"
            value={formData.location}
            onChange={onInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
            placeholder="City, Country"
          />
          <p className="mt-1 text-xs text-gray-500">
            Your location will be shown on your profile
          </p>
        </div>
      </div>
    </div>
  );
}
