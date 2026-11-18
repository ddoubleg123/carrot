import React from 'react';
import { Cog6ToothIcon, BellIcon, ShieldCheckIcon, UserCircleIcon, PhotoIcon } from '@heroicons/react/24/outline';

type SettingsLayoutProps = {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
};

const navigation = [
  { name: 'Account', href: 'account', icon: UserCircleIcon },
  { name: 'Profile', href: 'profile', icon: PhotoIcon },
  { name: 'Notifications', href: 'notifications', icon: BellIcon },
  { name: 'Privacy', href: 'privacy', icon: ShieldCheckIcon },
  { name: 'Playback', href: 'preferences', icon: Cog6ToothIcon },
];

export default function SettingsLayout({ children, activeTab, onTabChange }: SettingsLayoutProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex gap-1 overflow-x-auto border-b border-gray-100 px-3 py-3">
        {navigation.map((item) => {
          const isActive = activeTab === item.href;
          return (
            <button
              key={item.name}
              type="button"
              onClick={() => onTabChange(item.href)}
              className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium ${
                isActive ? 'bg-orange-500 text-white' : 'text-gray-600 hover:bg-orange-50 hover:text-gray-900'
              }`}
            >
              <item.icon className="h-4 w-4" aria-hidden="true" />
              {item.name}
            </button>
          );
        })}
      </div>
      <div className="px-6 py-6">{children}</div>
    </div>
  );
}
