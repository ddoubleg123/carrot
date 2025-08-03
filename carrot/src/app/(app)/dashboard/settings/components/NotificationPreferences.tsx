'use client';

import { useState } from 'react';
import { BellIcon, EnvelopeIcon } from '@heroicons/react/24/outline';

export default function NotificationPreferences() {
  const [notifications, setNotifications] = useState({
    emailReplies: true,
    localTrending: true,
    weeklyDigest: false,
  });

  const handleToggle = (key: keyof typeof notifications) => {
    const newValue = !notifications[key];
    setNotifications(prev => ({
      ...prev,
      [key]: newValue
    }));    
    // TODO: Implement notification preference update
    console.log(`Notification ${key} set to ${newValue}`);
  };

  return (
    <div className="bg-white shadow-sm rounded-lg p-6">
      <h2 className="text-lg font-medium text-gray-900 mb-6">Notification Preferences</h2>
      
      <div className="space-y-6">
        {/* Email Notifications */}
        <div>
          <h3 className="text-sm font-medium text-gray-900 mb-4 flex items-center">
            <EnvelopeIcon className="h-5 w-5 text-gray-400 mr-2" />
            Email Notifications
          </h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Replies to my carrots</p>
                <p className="text-sm text-gray-500">Get notified when someone replies to your carrots</p>
              </div>
              <button
                type="button"
                onClick={() => handleToggle('emailReplies')}
                className={`${
                  notifications.emailReplies ? 'bg-primary-600' : 'bg-gray-200'
                } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2`}
                role="switch"
                aria-checked={notifications.emailReplies}
              >
                <span className="sr-only">Toggle replies notifications</span>
                <span
                  aria-hidden="true"
                  className={`${
                    notifications.emailReplies ? 'translate-x-5' : 'translate-x-0'
                  } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                />
              </button>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Weekly digest</p>
                <p className="text-sm text-gray-500">Get a weekly summary of your activity</p>
              </div>
              <button
                type="button"
                onClick={() => handleToggle('weeklyDigest')}
                className={`${
                  notifications.weeklyDigest ? 'bg-primary-600' : 'bg-gray-200'
                } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2`}
                role="switch"
                aria-checked={notifications.weeklyDigest}
              >
                <span className="sr-only">Toggle weekly digest</span>
                <span
                  aria-hidden="true"
                  className={`${
                    notifications.weeklyDigest ? 'translate-x-5' : 'translate-x-0'
                  } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Push Notifications */}
        <div>
          <h3 className="text-sm font-medium text-gray-900 mb-4 flex items-center">
            <BellIcon className="h-5 w-5 text-gray-400 mr-2" />
            Push Notifications
          </h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Local trending carrots</p>
                <p className="text-sm text-gray-500">Get notified about trending carrots in your area</p>
              </div>
              <button
                type="button"
                onClick={() => handleToggle('localTrending')}
                className={`${
                  notifications.localTrending ? 'bg-primary-600' : 'bg-gray-200'
                } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2`}
                role="switch"
                aria-checked={notifications.localTrending}
              >
                <span className="sr-only">Toggle local trending notifications</span>
                <span
                  aria-hidden="true"
                  className={`${
                    notifications.localTrending ? 'translate-x-5' : 'translate-x-0'
                  } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                />
              </button>
            </div>
          </div>
        </div>

        <div className="pt-2">
          <button
            type="button"
            className="text-sm font-medium text-primary-600 hover:text-primary-500"
            onClick={() => {
              // TODO: Implement notification settings page
              console.log('View all notification settings');
            }}
          >
            View all notification settings
          </button>
        </div>
      </div>
    </div>
  );
}
