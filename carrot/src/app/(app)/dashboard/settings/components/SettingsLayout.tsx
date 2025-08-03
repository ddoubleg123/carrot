import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Cog6ToothIcon, BellIcon, ShieldCheckIcon, UserCircleIcon } from '@heroicons/react/24/outline';

type SettingsLayoutProps = {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
};

const navigation = [
  { name: 'Account', href: 'account', icon: UserCircleIcon },
  { name: 'Notifications', href: 'notifications', icon: BellIcon },
  { name: 'Privacy', href: 'privacy', icon: ShieldCheckIcon },
  { name: 'Preferences', href: 'preferences', icon: Cog6ToothIcon },
];

export default function SettingsLayout({ children, activeTab, onTabChange }: SettingsLayoutProps) {
  const pathname = usePathname();

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="w-64 pr-4 border-r border-gray-200">
        <div className="space-y-1">
          {navigation.map((item) => {
            const isActive = activeTab === item.href;
            return (
              <button
                key={item.name}
                onClick={() => onTabChange(item.href)}
                className={`w-full flex items-center px-4 py-2 text-sm font-medium rounded-md ${
                  isActive
                    ? 'bg-primary-50 text-primary-700 border-l-4 border-primary-500'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-l-4 border-transparent'
                }`}
              >
                <item.icon
                  className={`mr-3 h-5 w-5 ${
                    isActive ? 'text-primary-500' : 'text-gray-400'
                  }`}
                  aria-hidden="true"
                />
                {item.name}
              </button>
            );
          })}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 px-8 py-6">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white shadow-sm rounded-lg p-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
