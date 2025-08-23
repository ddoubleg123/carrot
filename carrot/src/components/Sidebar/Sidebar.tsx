'use client';

import Link from 'next/link';
import './avatar-glow.css';
import '../../app/(app)/dashboard/dashboard-tokens.css';
import { useSession } from 'next-auth/react';
import CarrotLogo from '../CarrotLogo';
import { SidebarIcons } from '../icons/SidebarIcons';
import { useState } from 'react';
import { logoutClient } from '../../lib/logoutClient';

const MENU = [
  {
    href: '/dashboard/search',
    icon: <SidebarIcons.Search />,
    label: 'Search',
  },
  {
    href: '/dashboard/notifications',
    icon: <SidebarIcons.Notifications />,
    label: 'Notifications',
  },
  {
    href: '/dashboard/patch',
    icon: <SidebarIcons.CarrotPatch />,
    label: 'Carrot Patch',
  },
  {
    href: '/dashboard/messages',
    icon: <SidebarIcons.Messages />,
    label: 'Messages',
  },
  {
    href: '/dashboard/rabbit',
    icon: <SidebarIcons.Rabbit />,
    label: 'Rabbit (AI)',
  },
  {
    href: '/dashboard/funds',
    icon: <SidebarIcons.Funds />,
    label: 'Funds',
  },
  {
    href: '/dashboard/settings',
    icon: <SidebarIcons.Settings />,
    label: 'Settings',
  },
];

export default function Sidebar() {
  // TODO: Replace with real notification state from API or context
  const hasNotifications = false;
  const { data: session, status } = useSession();
  const user = session?.user;
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Prevent rendering if not authenticated
  if (status !== 'authenticated' || !user) {
    return null;
  }

  const handleLogout = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await logoutClient();
    } catch (error) {
      window.location.href = '/login';
    } finally {
      // Keep disabled state until redirect happens to avoid double clicks
    }
  };

  return (
    <aside className="flex flex-col h-screen w-full overflow-hidden relative"
           style={{
             background: 'linear-gradient(135deg, #fb923c 0%, #f97316 100%)'
           }}>
      {/* Wave Animation Overlay */}
      <div className="absolute inset-0 z-0">
        {/* Wave Layer 1 - Very Visible */}
        <div 
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(circle at 20% 80%, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.3) 30%, transparent 60%)',
            animation: 'waveFloat 4s ease-in-out infinite'
          }}
        />
        
        {/* Wave Layer 2 - Very Visible */}
        <div 
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(circle at 80% 20%, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.2) 35%, transparent 65%)',
            animation: 'waveDrift 5s ease-in-out infinite'
          }}
        />
        
        {/* Wave Layer 3 - Very Visible */}
        <div 
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.1) 40%, transparent 70%)',
            animation: 'waveFlow 6s ease-in-out infinite reverse'
          }}
        />
      </div>
      
      {/* CSS Keyframes */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes waveFloat {
            0%, 100% { transform: translateY(0px) translateX(0px); }
            25% { transform: translateY(-15px) translateX(5px); }
            50% { transform: translateY(-8px) translateX(-3px); }
            75% { transform: translateY(-20px) translateX(2px); }
          }
          @keyframes waveDrift {
            0%, 100% { transform: translateY(0px) translateX(0px) rotate(0deg); }
            33% { transform: translateY(-12px) translateX(-4px) rotate(1deg); }
            66% { transform: translateY(-18px) translateX(3px) rotate(-0.5deg); }
          }
          @keyframes waveFlow {
            0%, 100% { transform: translateY(0px) translateX(0px) rotate(0deg); }
            25% { transform: translateY(-10px) translateX(2px) rotate(0.5deg); }
            50% { transform: translateY(-5px) translateX(-2px) rotate(-0.3deg); }
            75% { transform: translateY(-15px) translateX(1px) rotate(0.2deg); }
          }
        `
      }} />

      {/* Top Section: Clickable Logo */}
      <div className="flex-shrink-0 px-4 pt-6 pb-4 relative z-10">
        {/* Full Logo - Centered and larger, clickable */}
        <Link href="/dashboard" className="flex items-center justify-center px-4 py-3 rounded-xl hover:bg-white/10 transition-all duration-200 cursor-pointer transform hover:scale-105 max-lg:hidden text-white">
          <div className="flex-shrink-0 transform scale-150">
            <CarrotLogo />
          </div>
        </Link>
        
        {/* Compact Carrot Logo - Centered and larger, clickable */}
        <Link href="/dashboard" className="flex items-center justify-center px-4 py-3 rounded-xl hover:bg-white/10 transition-all duration-200 cursor-pointer transform hover:scale-105 lg:hidden text-white">
          <img
            src="/logo-carrot.png"
            alt="Carrot Home"
            width={56}
            height={56}
            className="object-contain"
            style={{ 
              width: '56px', 
              height: '56px',
              maxWidth: '56px',
              maxHeight: '56px'
            }}
          />
        </Link>
      </div>
      
      {/* Middle Section: Navigation - Flexible to fill space */}
      <div className="flex-1 flex flex-col min-h-0 px-4 relative z-10">
        {/* Menu Items - Tightly grouped */}
        <nav className="flex-shrink-0">
          <div className="nav-section flex flex-col space-y-0.5">
            {MENU.map((item, index) => (
              <Link 
                key={index}
                href={item.href} 
                className="nav-item group flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/10 transition-all duration-200 text-white/90 hover:text-white font-medium text-[15px] max-lg:justify-center cursor-pointer transform hover:scale-105" 
                title={item.label}
                onClick={item.href === '/login' ? handleLogout : undefined}
              >
                <span className="icon flex-shrink-0">{item.icon}</span>
                <span className="label max-lg:hidden">{item.label}</span>
              </Link>
            ))}
          </div>
          
          {/* Line separator directly after menu items */}
          <hr className="border-white/20 mt-3 mb-4 max-lg:hidden" />
        </nav>
        
        {/* Stats Section - With more spacing */}
        <div className="flex-shrink-0">
          <div className="px-4 text-[13px] text-white/80 font-normal mb-12 max-lg:hidden">
            1,859 Carrots Earned
          </div>
        </div>
        
        {/* Spacer to push user section to bottom */}
        <div className="flex-1"></div>
      </div>
      
      {/* Bottom Section: Avatar, Username, Logout - Fixed at bottom */}
      <div className="flex-shrink-0 px-4 pb-3 relative z-10">
        <div className="flex flex-col items-center">
          {/* Avatar - Smaller in icon-only mode */}
          <div className="w-[50px] h-[50px] rounded-full bg-white/20 mb-1.5 flex items-center justify-center max-lg:w-10 max-lg:h-10">
            {user?.image ? (
              <img
                src={user.image}
                alt={user?.name || 'Profile'}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="8.5" r="4"/>
                <ellipse cx="12" cy="17" rx="6.5" ry="4.5"/>
              </svg>
            )}
          </div>
          
          {/* Username - Hidden in icon-only mode */}
          <p className="text-xs font-medium text-center mb-1.5 w-full text-white max-lg:hidden">
            {
              (() => {
                const fromName = user?.name ? user.name.replace(/\s+/g, '').toLowerCase() : '';
                const fromEmail = user?.email ? user.email.split('@')[0] : '';
                const handle = fromName || fromEmail || 'user';
                return `@${handle}`;
              })()
            }
          </p>
          
          {/* Logout Button - Icon only in collapsed mode, full button in expanded mode */}
          <button 
            className={`group text-white/90 hover:text-white text-xs rounded-xl py-2 px-3 flex items-center justify-center gap-3 font-semibold w-full transition-all duration-200 transform hover:scale-105 hover:bg-white/10 max-lg:w-10 max-lg:h-10 max-lg:p-0 ${isSigningOut ? 'opacity-60 cursor-not-allowed' : ''}`} 
            style={{ border: 'none' }} 
            onClick={handleLogout}
            disabled={isSigningOut}
            title="Logout"
          >
            <span className="w-5 h-5 flex items-center justify-center flex-shrink-0">
              {isSigningOut ? (
                <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                </svg>
              ) : (
                <SidebarIcons.Logout />
              )}
            </span>
            <span className="max-lg:hidden">{isSigningOut ? 'Signing out…' : 'Logout'}</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
