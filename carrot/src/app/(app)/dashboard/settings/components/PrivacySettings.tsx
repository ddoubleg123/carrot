'use client';

import { useState } from 'react';
import { LockClosedIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

export default function PrivacySettings() {
  const [privacySettings, setPrivacySettings] = useState({
    profileVisibility: 'public', // 'public' | 'followers' | 'private'
    showEmail: false,
    showLocation: false,
  });

  const handleSettingChange = (setting: keyof typeof privacySettings, value: any) => {
    setPrivacySettings(prev => ({
      ...prev,
      [setting]: value
    }));
    // TODO: Implement privacy setting update
    console.log(`Privacy setting ${setting} set to ${value}`);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-medium text-gray-900">Privacy Settings</h2>
      
      <div className="space-y-6">
        {/* Privacy Notice */}
        <div className="bg-blue-50 p-4 rounded-md">
          <p className="text-sm text-blue-700">
            <span className="font-medium">Note:</span> Your email address and location are private by default. 
            You can choose to make them visible to others below.
          </p>
        </div>
        
        {/* Profile Visibility */}
        <div>
          <h3 className="text-sm font-medium text-gray-900 mb-2">Profile Visibility</h3>
          <p className="text-sm text-gray-500 mb-4">
            Control who can see your profile and activity
          </p>
          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="radio"
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                checked={privacySettings.profileVisibility === 'public'}
                onChange={() => handleSettingChange('profileVisibility', 'public')}
              />
              <span className="ml-2 block text-sm text-gray-900">
                Public - Anyone can see your profile and activity
              </span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                checked={privacySettings.profileVisibility === 'followers'}
                onChange={() => handleSettingChange('profileVisibility', 'followers')}
              />
              <span className="ml-2 block text-sm text-gray-900">
                Followers only - Only people you approve can see your activity
              </span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                checked={privacySettings.profileVisibility === 'private'}
                onChange={() => handleSettingChange('profileVisibility', 'private')}
              />
              <span className="ml-2 block text-sm text-gray-900">
                Private - Only you can see your profile and activity
              </span>
            </label>
          </div>
        </div>

        {/* Email Visibility */}
        <div className="pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-900">Email Address</h3>
              <p className="text-sm text-gray-500">
                {privacySettings.showEmail 
                  ? 'Your email is visible to others' 
                  : 'Your email is private'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleSettingChange('showEmail', !privacySettings.showEmail)}
              className={`${
                privacySettings.showEmail ? 'bg-primary-600' : 'bg-gray-200'
              } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2`}
            >
              <span className="sr-only">Toggle email visibility</span>
              <span
                className={`${
                  privacySettings.showEmail ? 'translate-x-5' : 'translate-x-0'
                } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
              />
            </button>
          </div>
        </div>

        {/* Location Visibility */}
        <div className="pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-900">Location</h3>
              <p className="text-sm text-gray-500">
                {privacySettings.showLocation 
                  ? 'Your location is visible to others' 
                  : 'Your location is private'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleSettingChange('showLocation', !privacySettings.showLocation)}
              className={`${
                privacySettings.showLocation ? 'bg-primary-600' : 'bg-gray-200'
              } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2`}
            >
              <span className="sr-only">Toggle location visibility</span>
              <span
                className={`${
                  privacySettings.showLocation ? 'translate-x-5' : 'translate-x-0'
                } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
