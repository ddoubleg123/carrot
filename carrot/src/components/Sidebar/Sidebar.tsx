'use client';

import Link from 'next/link';
import './avatar-glow.css';
import '../../app/(app)/dashboard/dashboard-tokens.css';
import { signOutAction } from '../../actions/auth-actions';
import { useSession } from 'next-auth/react';
import CarrotLogo from '../CarrotLogo';
import { SidebarIcons } from '../icons/SidebarIcons';

const MENU = [
  {
    href: '/dashboard',
    icon: <SidebarIcons.HomeCustom />, // Custom filled Home icon
    label: 'Home',
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
    href: '/dashboard/groups',
    icon: <SidebarIcons.Groups />, 
    label: 'Groups',
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
    <aside className="flex flex-col justify-between h-screen bg-white w-full">
      {/* Top Section: Logo + Nav Items */}
      <div className="px-4 pt-6">
        {/* Logo - Hidden in icon-only mode */}
        <div className="flex items-center justify-center max-lg:hidden" style={{ paddingTop: 16, paddingBottom: 16 }}>
          <CarrotLogo />
        </div>
        
        {/* Menu Items */}
        <nav>
          <div className="nav-section flex flex-col space-y-2.5">
            <Link href="/dashboard" className="nav-item flex items-center gap-3 px-4 py-2.5 rounded-md hover:bg-gray-100 transition-colors text-gray-700 font-medium text-[16px] max-lg:justify-center" title="Home">
              <span className="icon h-6 w-6"><SidebarIcons.HomeCustom /></span>
              <span className="label max-lg:hidden">Home</span>
            </Link>
            <Link href="/dashboard/notifications" className="nav-item flex items-center gap-3 px-4 py-2.5 rounded-md hover:bg-gray-100 transition-colors text-gray-700 font-medium text-[16px] max-lg:justify-center" title="Notifications">
              <span className="icon h-6 w-6">{hasNotifications ? <SidebarIcons.NotificationsActive /> : <SidebarIcons.Notifications />}</span>
              <span className="label max-lg:hidden">Notifications</span>
            </Link>
            <Link href="/dashboard/patch" className="nav-item flex items-center gap-3 px-4 py-2.5 rounded-md hover:bg-gray-100 transition-colors text-gray-700 font-medium text-[16px] max-lg:justify-center" title="Carrot Patch">
              <span className="icon h-6 w-6"><SidebarIcons.CarrotPatch /></span>
              <span className="label max-lg:hidden">Carrot Patch</span>
            </Link>
            <Link href="/dashboard/messages" className="nav-item flex items-center gap-3 px-4 py-2.5 rounded-md hover:bg-gray-100 transition-colors text-gray-700 font-medium text-[16px] max-lg:justify-center" title="Messages">
              <span className="icon h-6 w-6"><SidebarIcons.Messages /></span>
              <span className="label max-lg:hidden">Messages</span>
            </Link>
            <Link href="/dashboard/rabbit" className="nav-item flex items-center gap-3 px-4 py-2.5 rounded-md hover:bg-gray-100 transition-colors text-gray-700 font-medium text-[16px] max-lg:justify-center" title="Rabbit (AI)">
              <span className="icon h-6 w-6"><SidebarIcons.Rabbit /></span>
              <span className="label max-lg:hidden">Rabbit (AI)</span>
            </Link>
            <Link href="/dashboard/funds" className="nav-item flex items-center gap-3 px-4 py-2.5 rounded-md hover:bg-gray-100 transition-colors text-gray-700 font-medium text-[16px] max-lg:justify-center" title="Funds">
              <span className="icon h-6 w-6"><SidebarIcons.Funds /></span>
              <span className="label max-lg:hidden">Funds</span>
            </Link>
            <Link href="/dashboard/settings" className="nav-item flex items-center gap-3 px-4 py-2.5 rounded-md hover:bg-gray-100 transition-colors text-gray-700 font-medium text-[16px] max-lg:justify-center" title="Settings">
              <span className="icon h-6 w-6"><SidebarIcons.Settings /></span>
              <span className="label max-lg:hidden">Settings</span>
            </Link>
          </div>
          <hr className="border-t border-gray-200 my-4 max-lg:hidden" />
          <div className="px-4 text-[14px] text-gray-400 font-normal mb-4 max-lg:hidden">
            1,859 Carrots Earned
          </div>
        </nav>
      </div>
      
      {/* Bottom Section: Avatar, Username, Logout */}
      <div className="px-4 pb-6">
        <div className="flex flex-col items-center">
          {/* Avatar - Smaller in icon-only mode */}
          <div className="avatar-wrap avatar-glow mb-3 max-lg:w-10 max-lg:h-10" style={{ width: 80, height: 80 }}>
            {(user?.profilePhoto || user?.image) ? (
              <img
                src={user.profilePhoto || user.image || ''}
                alt={user.username || user.name || 'Profile'}
                className="sidebar-avatar-img"
                style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              <svg className="w-full h-full" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="8.5" r="4" fill="#fff" />
                <ellipse cx="12" cy="17" rx="6.5" ry="4.5" fill="#fff" />
              </svg>
            )}
          </div>
          
          {/* Username - Hidden in icon-only mode */}
          <p className="text-sm font-medium text-center mb-3 w-full max-lg:hidden">
            @{user?.username ? user.username : (user?.name ? user.name.replace(/\s+/g, '').toLowerCase() : 'username')}
          </p>
          
          {/* Logout Button - Icon only in lg, full button in xl */}
          <button 
            className="bg-orange-500 hover:bg-orange-600 text-white text-sm rounded-md py-2 flex items-center justify-center gap-2 font-bold shadow max-lg:w-10 max-lg:h-10 max-lg:p-0" 
            style={{ border: 'none', maxWidth: 200 }} 
            onClick={handleLogout}
            title="Logout"
          >
            <span className="w-4 h-4 flex items-center justify-center">
              <SidebarIcons.Logout />
            </span>
            <span className="max-lg:hidden">Logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
