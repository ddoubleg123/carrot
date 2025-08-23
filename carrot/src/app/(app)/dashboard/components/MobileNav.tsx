'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  HomeIcon, 
  MagnifyingGlassIcon, 
  UserIcon,
  Cog6ToothIcon,
  ArrowLeftOnRectangleIcon
} from '@heroicons/react/24/outline';
import { useState } from 'react';
import { logoutClient } from '../../../../lib/logoutClient';

// Main navigation items
const mainNavigation = [
  { name: 'Home', href: '/dashboard', icon: HomeIcon },
  { name: 'Explore', href: '/explore', icon: MagnifyingGlassIcon },
  { name: 'Profile', href: '/profile', icon: UserIcon },
  { name: 'Settings', href: '/settings', icon: Cog6ToothIcon },
];

export default function MobileNav() {
  const pathname = usePathname();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const handleLogout = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await logoutClient();
    } catch (error) {
      console.error('Error during logout:', error);
      window.location.href = '/login';
    } finally {
      // keep disabled until redirect
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 lg:hidden z-50">
      <div className="flex justify-around">
        {mainNavigation.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex flex-col items-center justify-center py-3 px-4 ${
                isActive ? 'text-primary' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="h-6 w-6" />
              <span className="text-xs mt-1">{item.name}</span>
            </Link>
          );
        })}
        
        {/* Logout Button */}
        <button
          onClick={handleLogout}
          disabled={isSigningOut}
          className={`flex flex-col items-center justify-center py-3 px-4 ${isSigningOut ? 'text-gray-400 cursor-not-allowed' : 'text-gray-500 hover:text-red-500'}`}
        >
          {isSigningOut ? (
            <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
            </svg>
          ) : (
            <ArrowLeftOnRectangleIcon className="h-6 w-6" />
          )}
          <span className="text-xs mt-1">{isSigningOut ? 'Signing out…' : 'Logout'}</span>
        </button>
      </div>
    </nav>
  );
}
