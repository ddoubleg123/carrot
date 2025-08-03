'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOutAction } from '@/actions/auth-actions';
import { 
  HomeIcon, 
  MagnifyingGlassIcon, 
  UserIcon,
  Cog6ToothIcon,
  ArrowLeftOnRectangleIcon
} from '@heroicons/react/24/outline';

// Main navigation items
const mainNavigation = [
  { name: 'Home', href: '/dashboard', icon: HomeIcon },
  { name: 'Explore', href: '/explore', icon: MagnifyingGlassIcon },
  { name: 'Profile', href: '/profile', icon: UserIcon },
  { name: 'Settings', href: '/settings', icon: Cog6ToothIcon },
];

export default function MobileNav() {
  const pathname = usePathname();
  const handleLogout = async () => {
    try {
      await signOutAction();
      // The server action will handle the redirect
    } catch (error) {
      console.error('Error during logout:', error);
      // Fallback to direct redirect if signOut fails
      window.location.href = '/login';
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
          className="flex flex-col items-center justify-center py-3 px-4 text-gray-500 hover:text-red-500"
        >
          <ArrowLeftOnRectangleIcon className="h-6 w-6" />
          <span className="text-xs mt-1">Logout</span>
        </button>
      </div>
    </nav>
  );
}
