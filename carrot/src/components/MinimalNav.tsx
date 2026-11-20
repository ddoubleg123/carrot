'use client';

import Link, { useLinkStatus } from 'next/link';
import CarrotLogo from './CarrotLogo';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { signOutAction } from '../actions/auth-actions';
import { SidebarIcons } from './icons/SidebarIcons';
import { logoutClient } from '../lib/logoutClient';
import { prefetchNotifications } from '../lib/notificationFeed';
import { useSession } from 'next-auth/react';
import { isAdminEmail } from '../lib/admin';

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
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2"/>
        <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="2"/>
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
  PolWatch: ({ isActive }: { isActive: boolean }) => (
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200 transform ${
      isActive
        ? 'bg-orange-500 text-white shadow-lg scale-[1.02]'
        : 'bg-white text-gray-700 border border-gray-200 hover:bg-orange-500 hover:text-white hover:shadow-lg hover:scale-[1.03] hover:border-transparent'
    }`}>
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
        <path d="M3 19h18M5.5 19V11M9.5 19V11M14.5 19V11M18.5 19V11" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
        <path d="M3.5 11h17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
        <path d="M7 11V8.5h10V11" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/>
        <path d="M12 8.5V5.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
        <circle cx="12" cy="4.2" r="1.05" fill="currentColor"/>
      </svg>
    </div>
  ),
  Admin: ({ isActive }: { isActive: boolean }) => (
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200 transform ${
      isActive
        ? 'bg-orange-500 text-white shadow-lg scale-[1.02]'
        : 'bg-white text-gray-700 border border-gray-200 hover:bg-orange-500 hover:text-white hover:shadow-lg hover:scale-[1.03] hover:border-transparent'
    }`}>
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
        <circle cx="8" cy="15" r="3.2" stroke="currentColor" strokeWidth="2"/>
        <path d="M10.5 13.2 20 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <path d="M16.5 7.2h2.2V9.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M14 9.6h2.2V11.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
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
        <path d="M12 3v2M12 19v2M3 12h2M19 12h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
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
    href: '/patch',
    icon: NavIcons.CarrotPatch,
    label: 'Carrot Patch',
  },
  {
    href: '/pol-watch',
    icon: NavIcons.PolWatch,
    label: 'Pol Watch',
  },
  {
    href: '/messages',
    icon: NavIcons.Messages,
    label: 'Messages',
  },
  {
    href: '/rabbit',
    icon: NavIcons.Rabbit,
    label: 'Rabbit (AI)',
  },
  {
    href: '/dashboard/funds',
    icon: NavIcons.Funds,
    label: 'Funds',
  },
  {
    href: '/settings',
    icon: NavIcons.Settings,
    label: 'Settings',
  },
];

const ADMIN_ITEM = {
  href: '/admin',
  icon: NavIcons.Admin,
  label: 'Admin',
}

export default function MinimalNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const items = isAdminEmail(session?.user?.email) ? [...MENU_ITEMS, ADMIN_ITEM] : MENU_ITEMS;
  useEffect(() => setMounted(true), []);

  // Build the menu pages one at a time after the current page is up, so the
  // first click is not waiting on a cold compile.
  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    const hrefs = MENU_ITEMS.map((item) => item.href).filter((href) => href !== '/rabbit');
    const warm = (index: number) => {
      if (cancelled || index >= hrefs.length) return;
      try { router.prefetch(hrefs[index]); } catch {}
      timer = window.setTimeout(() => warm(index + 1), 800);
    };
    timer = window.setTimeout(() => warm(0), 1200);
    const prefetchTimer = window.setTimeout(() => {
      if (!cancelled) prefetchNotifications();
    }, 1500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.clearTimeout(prefetchTimer);
    };
  }, [router]);

  const TooltipLayer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    if (!mounted) return null;
    return createPortal(children as any, document.body);
  };

  return (
    <nav className="w-full h-full flex flex-col items-center py-6" style={{ zIndex: 1000 }}>
      {/* Logo/Home */}
      <Link 
        href="/home" 
        prefetch={true}
        className="mb-8 p-2 rounded-xl hover:bg-orange-50 transition-colors duration-200"
        aria-label="Home"
      >
        <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg border border-gray-100">
          <div className="w-8 h-8" aria-hidden>
            <CarrotLogo />
          </div>
        </div>
      </Link>

      {/* Menu Items */}
      <div className="flex flex-col gap-4">
        {items.map((item, index) => {
          const path = pathname || ''
          const isActive = path === item.href || path.startsWith(`${item.href}/`)
          const IconComponent = item.icon;
          
          return (
            <div key={item.href} className="relative">
              <Link
                href={item.href}
                prefetch={item.href !== '/rabbit'}
                className="block"
                aria-label={item.label}
                onPointerDown={() => {
                  if (item.href === '/dashboard/notifications') prefetchNotifications();
                  if (item.href === '/rabbit') {
                    try { router.prefetch(item.href); } catch {}
                  }
                }}
                onMouseEnter={() => {
                  setHoveredItem(item.href);
                  if (item.href === '/dashboard/notifications') prefetchNotifications();
                  if (item.href === '/rabbit') {
                    try { router.prefetch(item.href); } catch {}
                  }
                }}
                onMouseLeave={() => setHoveredItem(null)}
              >
                <MenuIcon icon={IconComponent} active={isActive} />
              </Link>
              
              {/* Tooltip */}
              {hoveredItem === item.href && (
                <TooltipLayer>
                  <div 
                    className="fixed bg-gray-900 text-white px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap shadow-lg pointer-events-none"
                    style={{ 
                      zIndex: 2147483647,
                      left: '88px', // Position to the right of the 80px nav
                      top: `${120 + index * 52}px`
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

function MenuIcon({ icon: Icon, active }: { icon: typeof NavIcons.Messages; active: boolean }) {
  const { pending } = useLinkStatus();
  return <Icon isActive={active || pending} />;
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
