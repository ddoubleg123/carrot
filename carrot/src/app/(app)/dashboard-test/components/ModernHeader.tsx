'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { signOutAction } from '../../../../actions/auth-actions';
import CarrotLogo from '../../../../components/CarrotLogo';

// Modern, sleek header icons - smaller and more refined than sidebar versions
const HeaderIcons = {
  Home: ({ active = false }: { active?: boolean }) => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
      <path 
        d="M9 10a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-8z" 
        fill={active ? "#F97316" : "currentColor"}
      />
      <path 
        d="M12 6l-4 4h8l-4-4z" 
        fill={active ? "#F97316" : "currentColor"}
      />
    </svg>
  ),
  Search: ({ active = false }: { active?: boolean }) => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
      <circle 
        cx="11" cy="11" r="3" 
        stroke={active ? "#F97316" : "currentColor"} 
        strokeWidth="1.5" 
        fill="none"
      />
      <path 
        d="m17 17-3.5-3.5" 
        stroke={active ? "#F97316" : "currentColor"} 
        strokeWidth="1.5" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
    </svg>
  ),
  Notifications: ({ active = false, hasNotifications = false }: { active?: boolean; hasNotifications?: boolean }) => (
    <div className="relative">
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
        <path 
          d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" 
          stroke={active ? "#F97316" : "currentColor"} 
          strokeWidth="1.5" 
          fill="none"
        />
        <path 
          d="M13.73 21a2 2 0 0 1-3.46 0" 
          stroke={active ? "#F97316" : "currentColor"} 
          strokeWidth="1.5" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        />
      </svg>
      {hasNotifications && (
        <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></div>
      )}
    </div>
  ),
  CarrotPatch: ({ active = false }: { active?: boolean }) => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
      <path 
        d="M9 15c0 1.66 1.34 3 3 3s3-1.34 3-3c0-1.66-1.34-3-3-3s-3 1.34-3 3z" 
        fill={active ? "#F97316" : "currentColor"}
      />
      <path 
        d="M11 9l1-2 1 2-1 1-1-1z" 
        fill={active ? "#22C55E" : "#10B981"}
      />
    </svg>
  ),
  Messages: ({ active = false }: { active?: boolean }) => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
      <path 
        d="M18 14a1 1 0 0 1-1 1H8l-2 2V8a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1z" 
        stroke={active ? "#F97316" : "currentColor"} 
        strokeWidth="1.5" 
        fill="none"
      />
    </svg>
  ),
  Rabbit: ({ active = false }: { active?: boolean }) => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
      <ellipse cx="9" cy="6" rx="1.5" ry="3" fill={active ? "#F97316" : "currentColor"}/>
      <ellipse cx="15" cy="6" rx="1.5" ry="3" fill={active ? "#F97316" : "currentColor"}/>
      <circle cx="12" cy="13" r="4" fill={active ? "#F97316" : "currentColor"}/>
      <circle cx="10.5" cy="12" r="0.8" fill="white"/>
      <circle cx="13.5" cy="12" r="0.8" fill="white"/>
      <path d="M12 14.5c-0.5 0-1-0.3-1-0.8s0.5-0.8 1-0.8s1 0.3 1 0.8s-0.5 0.8-1 0.8z" fill="white"/>
    </svg>
  ),
  Funds: ({ active = false }: { active?: boolean }) => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
      <line 
        x1="12" y1="4" x2="12" y2="20" 
        stroke={active ? "#F97316" : "currentColor"} 
        strokeWidth="1.5" 
        strokeLinecap="round"
      />
      <path 
        d="M16 7H10.5a2.5 2.5 0 0 0 0 5h3a2.5 2.5 0 0 1 0 5H8" 
        stroke={active ? "#F97316" : "currentColor"} 
        strokeWidth="1.5" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
    </svg>
  ),
  Settings: ({ active = false }: { active?: boolean }) => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
      <path 
        d="M12 7v1.5M12 15.5v1.5M16.5 12h-1.5M9 12H7.5M15.5 8.5l-1 1M9.5 14.5l-1 1M15.5 15.5l-1-1M9.5 9.5l-1-1" 
        stroke={active ? "#F97316" : "currentColor"} 
        strokeWidth="1.5" 
        strokeLinecap="round"
      />
      <circle 
        cx="12" cy="12" r="3" 
        stroke={active ? "#F97316" : "currentColor"} 
        strokeWidth="1.5" 
        fill="none"
      />
    </svg>
  ),
  ChevronDown: () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Logout: () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <polyline points="16,17 21,12 16,7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
};

const PRIMARY_NAV = [
  { href: '/dashboard-test/patch', icon: HeaderIcons.CarrotPatch, label: 'Patch', key: 'patch' },
  { href: '/dashboard-test/messages', icon: HeaderIcons.Messages, label: 'Messages', key: 'messages' },
  { href: '/dashboard-test/rabbit', icon: HeaderIcons.Rabbit, label: 'AI', key: 'rabbit' },
];

const SECONDARY_NAV = [
  // Moved to avatar dropdown menu
];

export default function ModernHeader() {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [userMenuHover, setUserMenuHover] = useState(false);
  const { data: session } = useSession();
  const user = session?.user;
  const hasNotifications = false; // TODO: Replace with real notification state
  const pathname = usePathname();

  const handleLogout = async () => {
    try {
      await signOutAction();
    } catch (error) {
      window.location.href = '/login';
    }
  };

  // Get current path to determine active nav item
  const currentPath = pathname;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-200/50 shadow-sm">
      {/* Match exact layout.tsx container structure */}
      <div className="flex w-full max-w-[1400px] mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16 w-full">
          
          {/* Left Section: Logo - Aligned with composer content */}
          <div className="flex-shrink-0" style={{ marginLeft: '32px' }}>
            <Link href="/dashboard-test" className="flex items-center hover:opacity-80 transition-opacity">
              <div className="w-12 h-12">
                <CarrotLogo />
              </div>
            </Link>
          </div>

          {/* Center Section: Wide Search Input */}
          <div className="flex-1 max-w-lg mx-6">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <HeaderIcons.Search />
              </div>
              <input
                type="text"
                placeholder="Search Carrot..."
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-orange-500 focus:border-orange-500 text-sm"
              />
            </div>
          </div>

          {/* Right Section: Navigation Icons + Notifications + Avatar */}
          <div className="flex items-center space-x-2">
            
            {/* Primary Navigation Icons - Left of Notifications */}
            <nav className="hidden md:flex items-center space-x-1">
              {PRIMARY_NAV.map((item) => {
                const isActive = currentPath === item.href || currentPath.startsWith(item.href + '/');
                const IconComponent = item.icon;
                
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={`
                      p-2 rounded-lg transition-all duration-200
                      ${isActive 
                        ? 'bg-orange-50 text-orange-600 shadow-sm' 
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                      }
                    `}
                    title={item.label}
                  >
                    <IconComponent active={isActive} />
                  </Link>
                );
              })}
            </nav>

            {/* Notifications Icon */}
            <Link
              href="/dashboard-test/notifications"
              className={`
                p-2 rounded-lg transition-all duration-200
                ${currentPath === '/dashboard-test/notifications' || currentPath.startsWith('/dashboard-test/notifications/')
                  ? 'bg-orange-50 text-orange-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }
              `}
              title="Notifications"
            >
              <HeaderIcons.Notifications 
                active={currentPath === '/dashboard-test/notifications' || currentPath.startsWith('/dashboard-test/notifications/')}
                hasNotifications={hasNotifications}
              />
            </Link>

            {/* User Profile Dropdown - Aligned with composer content */}
            <div 
              className="relative" 
              style={{ marginRight: '32px' }}
              onMouseEnter={() => setUserMenuHover(true)}
              onMouseLeave={() => setUserMenuHover(false)}
            >
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center rounded-lg hover:bg-gray-50 transition-colors"
              >
                {/* Avatar */}
                <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center overflow-hidden">
                  {user?.image ? (
                    <img
                      src={user.image}
                      alt={user.name || 'Profile'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <svg className="w-5 h-5 text-orange-600" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="12" cy="8.5" r="4"/>
                      <ellipse cx="12" cy="17" rx="6.5" ry="4.5"/>
                    </svg>
                  )}
                </div>
              </button>

              {/* Dropdown Menu - Show on hover or click */}
              {(userMenuOpen || userMenuHover) && (
                <>
                  {/* Backdrop */}
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setUserMenuOpen(false)}
                  ></div>
                                    {/* Menu */}
                   <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                     <div className="px-4 py-2 border-b border-gray-100">
                       <p className="text-sm font-medium text-gray-900">
                         {user?.name || 'User'}
                       </p>
                       <p className="text-xs text-gray-500">
                         @{user?.name ? user.name.replace(/\s+/g, '').toLowerCase() : 'user'}
                       </p>
                     </div>
                     
                     {/* Carrots Earned - Top priority */}
                     <div className="px-4 py-3 border-b border-gray-100">
                       <div className="flex items-center space-x-2 text-sm">
                         <span className="text-orange-500 font-medium">🥕</span>
                         <span className="font-medium text-gray-900">1,859</span>
                         <span className="text-gray-500">Carrots</span>
                       </div>
                     </div>
                     
                     {/* Funds */}
                     <Link
                       href="/dashboard-test/funds"
                       className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                       onClick={() => setUserMenuOpen(false)}
                     >
                       <HeaderIcons.Funds active={currentPath === '/dashboard-test/funds' || currentPath.startsWith('/dashboard-test/funds/')} />
                       <span>Funds</span>
                     </Link>
                     
                     {/* Settings */}
                     <Link
                       href="/dashboard-test/settings"
                       className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                       onClick={() => setUserMenuOpen(false)}
                     >
                       <HeaderIcons.Settings active={currentPath === '/dashboard-test/settings' || currentPath.startsWith('/dashboard-test/settings/')} />
                       <span>Settings</span>
                     </Link>
                     
                     {/* Separator */}
                     <div className="border-t border-gray-100 my-1"></div>
                     
                     <button
                       onClick={handleLogout}
                       className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                     >
                       <HeaderIcons.Logout />
                       <span>Logout</span>
                     </button>
                   </div>
                </>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button className="md:hidden p-2 rounded-lg hover:bg-gray-50">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                <path d="M3 12h18M3 6h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
