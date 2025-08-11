'use client';

import Link from 'next/link';
import './avatar-glow.css';
import '../../app/(app)/dashboard/dashboard-tokens.css';
import { signOutAction } from '../../actions/auth-actions';
import { useSession } from 'next-auth/react';
import CarrotLogo from '../CarrotLogo';
import { SidebarIcons } from '../icons/SidebarIcons';

// Vibrant circular icons for the new sidebar design - making them LARGER to match action row visually
const VibrantSidebarIcons = {
  Search: () => (
    <svg className="w-10 h-10 sm:w-10 sm:h-10" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="11" fill="#10B981"/>
      <circle cx="11" cy="11" r="3" stroke="white" strokeWidth="1.5" fill="none"/>
      <path d="m17 17-3.5-3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Notifications: () => (
    <svg className="w-10 h-10 sm:w-10 sm:h-10" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="11" fill="#EF4444"/>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" stroke="white" strokeWidth="1.5" fill="none"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  CarrotPatch: () => (
    <svg className="w-10 h-10 sm:w-10 sm:h-10" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="11" fill="#F97316"/>
      <path d="M9 15c0 1.66 1.34 3 3 3s3-1.34 3-3c0-1.66-1.34-3-3-3s-3 1.34-3 3z" fill="white"/>
      <path d="M11 9l1-2 1 2-1 1-1-1z" fill="#22C55E"/>
    </svg>
  ),
  Messages: () => (
    <svg className="w-10 h-10 sm:w-10 sm:h-10" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="11" fill="#06B6D4"/>
      <path d="M18 14a1 1 0 0 1-1 1H8l-2 2V8a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1z" stroke="white" strokeWidth="1.5" fill="none"/>
    </svg>
  ),
  Rabbit: () => (
    <svg className="w-10 h-10 sm:w-10 sm:h-10" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="11" fill="#8B5CF6"/>
      {/* Rabbit ears */}
      <ellipse cx="9" cy="6" rx="1.5" ry="3" fill="white"/>
      <ellipse cx="15" cy="6" rx="1.5" ry="3" fill="white"/>
      {/* Rabbit head */}
      <circle cx="12" cy="13" r="4" fill="white"/>
      {/* Eyes */}
      <circle cx="10.5" cy="12" r="0.8" fill="#8B5CF6"/>
      <circle cx="13.5" cy="12" r="0.8" fill="#8B5CF6"/>
      {/* Nose */}
      <path d="M12 14.5c-0.5 0-1-0.3-1-0.8s0.5-0.8 1-0.8s1 0.3 1 0.8s-0.5 0.8-1 0.8z" fill="#8B5CF6"/>
      {/* AI sparkle */}
      <path d="M16 8l-0.5 0.5 0.5 0.5 0.5-0.5-0.5-0.5z" fill="white"/>
      <path d="M8 16l-0.5 0.5 0.5 0.5 0.5-0.5-0.5-0.5z" fill="white"/>
    </svg>
  ),
  Funds: () => (
    <svg className="w-10 h-10 sm:w-10 sm:h-10" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="11" fill="#F59E0B"/>
      <line x1="12" y1="4" x2="12" y2="20" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M16 7H10.5a2.5 2.5 0 0 0 0 5h3a2.5 2.5 0 0 1 0 5H8" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Settings: () => (
    <svg className="w-10 h-10 sm:w-10 sm:h-10" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="11" fill="#64748B"/>
      {/* Simplified gear teeth */}
      <path d="M12 7v1.5M12 15.5v1.5M16.5 12h-1.5M9 12H7.5M15.5 8.5l-1 1M9.5 14.5l-1 1M15.5 15.5l-1-1M9.5 9.5l-1-1" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
      {/* Center gear circle */}
      <circle cx="12" cy="12" r="3" stroke="white" strokeWidth="1.5" fill="none"/>
      {/* Inner center dot */}
      <circle cx="12" cy="12" r="1" fill="white"/>
    </svg>
  ),
  Logout: () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <polyline points="16,17 21,12 16,7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="21" y1="12" x2="9" y2="12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
};

const MENU = [
  {
    href: '/dashboard/search',
    icon: <VibrantSidebarIcons.Search />,
    label: 'Search',
  },
  {
    href: '/dashboard/notifications',
    icon: <VibrantSidebarIcons.Notifications />,
    label: 'Notifications',
  },
  {
    href: '/dashboard/patch',
    icon: <VibrantSidebarIcons.CarrotPatch />,
    label: 'Carrot Patch',
  },
  {
    href: '/dashboard/messages',
    icon: <VibrantSidebarIcons.Messages />,
    label: 'Messages',
  },
  {
    href: '/dashboard/rabbit',
    icon: <VibrantSidebarIcons.Rabbit />,
    label: 'Rabbit (AI)',
  },
  {
    href: '/dashboard/funds',
    icon: <VibrantSidebarIcons.Funds />,
    label: 'Funds',
  },
  {
    href: '/dashboard/settings',
    icon: <VibrantSidebarIcons.Settings />,
    label: 'Settings',
  },
];

export default function Sidebar() {
  // TODO: Replace with real notification state from API or context
  const hasNotifications = false;
  const { data: session, status } = useSession();
  const user = session?.user;

  // Prevent rendering if not authenticated
  if (status !== 'authenticated' || !user) {
    return null;
  }

  const handleLogout = async () => {
    try {
      await signOutAction();
    } catch (error) {
      window.location.href = '/login';
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
        <Link href="/dashboard" className="flex items-center justify-center px-4 py-3 rounded-xl hover:bg-white/10 transition-all duration-200 cursor-pointer transform hover:scale-105 max-lg:hidden">
          <div className="flex-shrink-0 transform scale-150">
            <CarrotLogo />
          </div>
        </Link>
        
        {/* Compact Carrot Logo - Centered and larger, clickable */}
        <Link href="/dashboard" className="flex items-center justify-center px-4 py-3 rounded-xl hover:bg-white/10 transition-all duration-200 cursor-pointer transform hover:scale-105 lg:hidden">
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
                className="nav-item flex items-center gap-3 px-3 py-1.5 rounded-xl hover:bg-white/10 transition-all duration-200 text-black font-medium text-[15px] max-lg:justify-center cursor-pointer transform hover:scale-105" 
                title={item.label}
              >
                <span className="icon flex-shrink-0">{item.icon}</span>
                <span className="label max-lg:hidden">{item.label}</span>
              </Link>
            ))}
          </div>
          
          {/* Line separator directly after menu items */}
          <hr className="border-black/20 mt-3 mb-4 max-lg:hidden" />
        </nav>
        
        {/* Stats Section - With more spacing */}
        <div className="flex-shrink-0">
          <div className="px-4 text-[13px] text-black/80 font-normal mb-12 max-lg:hidden">
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
            {(user?.profilePhoto || user?.image) ? (
              <img
                src={user.profilePhoto || user.image || ''}
                alt={user.username || user.name || 'Profile'}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <svg className="w-6 h-6 text-black" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="8.5" r="4"/>
                <ellipse cx="12" cy="17" rx="6.5" ry="4.5"/>
              </svg>
            )}
          </div>
          
          {/* Username - Hidden in icon-only mode */}
          <p className="text-xs font-medium text-center mb-1.5 w-full text-black max-lg:hidden">
            @{user?.username ? user.username : (user?.name ? user.name.replace(/\s+/g, '').toLowerCase() : 'username')}
          </p>
          
          {/* Logout Button - Icon only in collapsed mode, full button in expanded mode */}
          <button 
            className="bg-orange-500 hover:bg-orange-600 text-black text-xs rounded-xl py-2 px-3 flex items-center justify-center gap-2 font-bold shadow w-full transition-all duration-200 transform hover:scale-105 max-lg:w-10 max-lg:h-10 max-lg:p-0" 
            style={{ border: 'none' }} 
            onClick={handleLogout}
            title="Logout"
          >
            <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
              <VibrantSidebarIcons.Logout />
            </span>
            <span className="max-lg:hidden">Logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
