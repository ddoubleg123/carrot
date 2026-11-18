'use client';

import { useEffect, useState } from 'react';
import { BellIcon, EnvelopeIcon } from '@heroicons/react/24/outline';

const PREFS_KEY = 'carrot-notification-prefs';

export default function NotificationPreferences() {
  const [notifications, setNotifications] = useState({
    emailReplies: true,
    localTrending: true,
    weeklyDigest: false,
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (raw) setNotifications((prev) => ({ ...prev, ...JSON.parse(raw) }));
    } catch {}
  }, []);

  const handleToggle = (key: keyof typeof notifications) => {
    setNotifications(prev => {
      const next = { ...prev, [key]: !prev[key] };
      try { localStorage.setItem(PREFS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
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

        <p className="text-xs text-gray-500">These choices stay on this device. Likes and comments still appear in Notifications.</p>
      </div>
    </div>
  );
}
