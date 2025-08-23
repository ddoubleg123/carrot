'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { signOutAction } from '../actions/auth-actions';
import { SidebarIcons } from './icons/SidebarIcons';
import { logoutClient } from '../lib/logoutClient';

// Minimalist icon components unified with currentColor
const NavIcons = {
  Search: ({ isActive }: { isActive: boolean }) => (
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200 transform ${
      isActive
        ? 'bg-orange-500 text-white shadow-lg scale-[1.02]'
        : 'bg-white text-gray-700 border border-gray-200 hover:bg-orange-500 hover:text-white hover:shadow-lg hover:scale-[1.03] hover:border-transparent'
    }`}>
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
        <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
        <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  ),
  Notifications: ({ isActive }: { isActive: boolean }) => (
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200 transform ${
      isActive
        ? 'bg-orange-500 text-white shadow-lg scale-[1.02]'
        : 'bg-white text-gray-700 border border-gray-200 hover:bg-orange-500 hover:text-white hover:shadow-lg hover:scale-[1.03] hover:border-transparent'
    }`}>
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" stroke="currentColor" strokeWidth="2"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  ),
  CarrotPatch: ({ isActive }: { isActive: boolean }) => (
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200 transform ${
      isActive
        ? 'bg-orange-500 text-white shadow-lg scale-[1.02]'
        : 'bg-white text-gray-700 border border-gray-200 hover:bg-orange-500 hover:text-white hover:shadow-lg hover:scale-[1.03] hover:border-transparent'
    }`}>
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
        <rect x="4" y="6" width="12" height="2" rx="1" fill="currentColor" opacity="0.9"/>
        <rect x="4" y="9" width="10" height="2" rx="1" fill="currentColor" opacity="0.9"/>
        <rect x="4" y="12" width="14" height="2" rx="1" fill="currentColor"/>
        <rect x="4" y="15" width="8" height="2" rx="1" fill="currentColor" opacity="0.8"/>
      </svg>
    </div>
  ),
  Messages: ({ isActive }: { isActive: boolean }) => (
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200 transform ${
      isActive
        ? 'bg-orange-500 text-white shadow-lg scale-[1.02]'
        : 'bg-white text-gray-700 border border-gray-200 hover:bg-orange-500 hover:text-white hover:shadow-lg hover:scale-[1.03] hover:border-transparent'
    }`}>
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="2"/>
      </svg>
    </div>
  ),
  Rabbit: ({ isActive }: { isActive: boolean }) => (
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200 transform ${
      isActive
        ? 'bg-orange-500 text-white shadow-lg scale-[1.02]'
        : 'bg-white text-gray-700 border border-gray-200 hover:bg-orange-500 hover:text-white hover:shadow-lg hover:scale-[1.03] hover:border-transparent'
    }`}>
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
        <ellipse cx="10" cy="7" rx="1.2" ry="4" fill="currentColor"/>
        <ellipse cx="14" cy="7" rx="1.2" ry="4" fill="currentColor"/>
        <ellipse cx="12" cy="14" rx="5" ry="4.5" fill="currentColor"/>
      </svg>
    </div>
  ),
  Funds: ({ isActive }: { isActive: boolean }) => (
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200 transform ${
      isActive
        ? 'bg-orange-500 text-white shadow-lg scale-[1.02]'
        : 'bg-white text-gray-700 border border-gray-200 hover:bg-orange-500 hover:text-white hover:shadow-lg hover:scale-[1.03] hover:border-transparent'
    }`}>
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
        <line x1="12" y1="2" x2="12" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  ),
  Settings: ({ isActive }: { isActive: boolean }) => (
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200 transform ${
      isActive
        ? 'bg-orange-500 text-white shadow-lg scale-[1.02]'
        : 'bg-white text-gray-700 border border-gray-200 hover:bg-orange-500 hover:text-white hover:shadow-lg hover:scale-[1.03] hover:border-transparent'
    }`}>
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
        <path d="m12 1 3 6 6 3-6 3-3 6-3-6-6-3 6-3 3-6z" stroke="currentColor" strokeWidth="2"/>
      </svg>
    </div>
  ),
};

const MENU_ITEMS = [
  {
    href: '/dashboard/search',
    icon: NavIcons.Search,
    label: 'Search',
  },
  {
    href: '/dashboard/notifications',
    icon: NavIcons.Notifications,
    label: 'Notifications',
  },
  {
    href: '/dashboard/patch',
    icon: NavIcons.CarrotPatch,
    label: 'Carrot Patch',
  },
  {
    href: '/dashboard/messages',
    icon: NavIcons.Messages,
    label: 'Messages',
  },
  {
    href: '/dashboard/rabbit',
    icon: NavIcons.Rabbit,
    label: 'Rabbit (AI)',
  },
  {
    href: '/dashboard/funds',
    icon: NavIcons.Funds,
    label: 'Funds',
  },
  {
    href: '/dashboard/settings',
    icon: NavIcons.Settings,
    label: 'Settings',
  },
];

export default function MinimalNav() {
  const pathname = usePathname();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const TooltipLayer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    if (!mounted) return null;
    return createPortal(children as any, document.body);
  };

  return (
    <nav className="w-full h-full flex flex-col items-center py-6" style={{ zIndex: 1000 }}>
      {/* Logo/Home */}
      <Link 
        href="/home" 
        className="mb-8 p-2 rounded-xl hover:bg-orange-50 transition-colors duration-200"
      >
        <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg border border-gray-100">
          <img 
            src="/logo-carrot.png" 
            alt="Carrot Logo" 
            className="w-8 h-8"
          />
        </div>
      </Link>

      {/* Menu Items */}
      <div className="flex flex-col gap-4">
        {MENU_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const IconComponent = item.icon;
          
          return (
            <div key={item.href} className="relative">
              <Link
                href={item.href}
                className="block"
                onMouseEnter={() => setHoveredItem(item.href)}
                onMouseLeave={() => setHoveredItem(null)}
              >
                <IconComponent isActive={isActive} />
              </Link>
              
              {/* Tooltip */}
              {hoveredItem === item.href && (
                <TooltipLayer>
                  <div 
                    className="fixed bg-gray-900 text-white px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap shadow-lg pointer-events-none"
                    style={{ 
                      zIndex: 2147483647,
                      left: '88px', // Position to the right of the 80px nav
                      top: `${item.href === MENU_ITEMS[0].href ? '120px' : 
                            item.href === MENU_ITEMS[1].href ? '172px' :
                            item.href === MENU_ITEMS[2].href ? '224px' :
                            item.href === MENU_ITEMS[3].href ? '276px' :
                            item.href === MENU_ITEMS[4].href ? '328px' :
                            item.href === MENU_ITEMS[5].href ? '380px' : '432px'}`
                    }}
                  >
                    {item.label}
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-2 h-2 bg-gray-900 rotate-45"></div>
                  </div>
                </TooltipLayer>
              )}
            </div>
          );
        })}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Logout at bottom */}
      <LogoutButton />
    </nav>
  );
}

function LogoutButton() {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const onClick = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await logoutClient();
    } catch (e) {
      window.location.href = '/login';
    } finally {
      // keep disabled until redirect
    }
  };
  return (
    <button
      onClick={onClick}
      disabled={isSigningOut}
      title="Logout"
      className={`mt-auto mb-2 block w-12 h-12 rounded-xl border transition-all duration-200 transform flex items-center justify-center ${isSigningOut ? 'bg-white text-gray-400 border-gray-200 cursor-not-allowed' : 'bg-white text-gray-700 border-gray-200 hover:text-orange-600 hover:bg-orange-50 hover:shadow-lg hover:scale-[1.03] hover:border-orange-200'}`}
    >
      <span className="w-5 h-5 text-current">
        {isSigningOut ? (
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
          </svg>
        ) : (
          <SidebarIcons.Logout />
        )}
      </span>
    </button>
  );
}
