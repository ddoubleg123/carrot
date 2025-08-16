// Sidebar icon components using currentColor for easy theming
// All icons 24x24, strokeWidth=1.5, color inherits from parent (currentColor)

import React from "react";

// All icons are 24×24, stroke #6B7280, strokeWidth 1.5, no fill

// Custom filled/bold Home icon to match reference image
export const HomeIconCustom = (props: React.SVGProps<SVGSVGElement>) => {
  // console.log("Rendering HomeIconCustom");
  return (
    <svg viewBox="0 0 24 24" width={24} height={24} fill="currentColor" {...props}>
      <path d="M3 12L12 4l9 8v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7z" />
      <path d="M9 21V12h6v9" fill="#fff" fillOpacity=".15" />
    </svg>
  );
};

export const HomeIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M3 12L12 4l9 8" />
    <path d="M9 21V9h6v12" />
    <path d="M21 21H3" />
  </svg>
);

export const BellIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11c0-3.07-1.64-5.64-5-5.958V5a2 2 0 10-4 0v.042C5.64 5.36 4 7.929 4 11v3.159c0 .538-.214 1.055-.595 1.436L2 17h5m8 0a3 3 0 01-6 0m6 0H9" />
  </svg>
);

export const UsersIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M17 21v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2" />
    <circle cx={9} cy={7} r={4} />
    <path d="M23 21v-2a4 4 0 00-3-3.87" />
    <path d="M16 3.13a4 4 0 010 7.75" />
  </svg>
);

export const ChatIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
  </svg>
);

// NotificationsIcon (vertically center bell)
// NotificationsIcon (vertically center bell)
export const NotificationsIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width={24} height={24} fill="currentColor" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11c0-3.07-1.64-5.64-5-5.958V5a2 2 0 10-4 0v.042C5.64 5.36 4 7.929 4 11v3.159c0 .538-.214 1.055-.595 1.436L2 17h5m8 0a3 3 0 01-6 0m6 0H9" />
  </svg>
);

// Active notifications icon (green dot)
export const NotificationsIconActive = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width={24} height={24} fill="currentColor" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11c0-3.07-1.64-5.64-5-5.958V5a2 2 0 10-4 0v.042C5.64 5.36 4 7.929 4 11v3.159c0 .538-.214 1.055-.595 1.436L2 17h5m8 0a3 3 0 01-6 0m6 0H9" />
  </svg>
);

export const GroupsIcon = (props: React.SVGProps<SVGSVGElement>) => (
  // Refined: three people, classic group, uses currentColor
  <svg viewBox="0 0 24 24" width={24} height={24} fill="none" {...props}>
    {/* Left person */}
    <circle cx="7.5" cy="12.2" r="1.2" fill="currentColor" />
    <ellipse cx="7.5" cy="15.2" rx="1.7" ry="1" fill="currentColor" />
    {/* Right person */}
    <circle cx="16.5" cy="12.2" r="1.2" fill="currentColor" />
    <ellipse cx="16.5" cy="15.2" rx="1.7" ry="1" fill="currentColor" />
    {/* Center person (front) */}
    <circle cx="12" cy="10.2" r="1.7" fill="currentColor" />
    <ellipse cx="12" cy="13.7" rx="2.3" ry="1.4" fill="currentColor" />
  </svg>
);

export const MessagesIcon = (props: React.SVGProps<SVGSVGElement>) => (
  // Filled chat bubble, uses currentColor
  <svg viewBox="0 0 24 24" width={24} height={24} fill="none" {...props}>
    <path d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7.5L4 21v-3V6a2 2 0 0 1 2-2z" fill="currentColor" />
  </svg>
);

// Custom RabbitIcon (big ears, circuit ear)
export const RabbitIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 64 64"
    width={24}
    height={24}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    {/* Bunny head outline */}
    <path
      d="M20 26C12 14 12 4 20 8c5 2 8 8 12 8s7-6 12-8c8-4 8 6 0 18"
      stroke="currentColor"
      strokeWidth={3}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Face outline */}
    <ellipse
      cx="32"
      cy="44"
      rx="20"
      ry="16"
      stroke="#444C53"
      strokeWidth={3}
      fill="none"
    />
    {/* Eyes */}
    <circle cx="24" cy="46" r="2.2" fill="currentColor" />
    <circle cx="40" cy="46" r="2.2" fill="currentColor" />
    {/* Nose & mouth */}
    <path
      d="M32 50v2m-2 2c1.3 1 2.7 1 4 0"
      stroke="#444C53"
      strokeWidth={2}
      strokeLinecap="round"
    />
    {/* Orange circuit lines in right ear */}
    <g stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
      <line x1="52" y1="14" x2="57" y2="24" />
      <line x1="48" y1="18" x2="54" y2="28" />
      <circle cx="52" cy="14" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="57" cy="24" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="48" cy="18" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="54" cy="28" r="1.5" fill="currentColor" stroke="none" />
    </g>
  </svg>
);

export const FundsIcon = (props: React.SVGProps<SVGSVGElement>) => (
  // Filled wallet icon, uses currentColor
  <svg viewBox="0 0 24 24" width={24} height={24} fill="none" {...props}>
    {/* Wallet body */}
    <rect x="3" y="7" width="18" height="10" rx="2.5" fill="currentColor" />
    {/* Flap */}
    <rect x="3" y="5" width="13" height="4" rx="1.2" fill="currentColor" />
    {/* Button */}
    <circle cx="18" cy="12" r="1" fill="currentColor" />
  </svg>
);

export const CarrotPatchIcon = (props: React.SVGProps<SVGSVGElement>) => (
  // Stylized patch: single seedling, two leaves, wide base
  <svg viewBox="0 0 32 32" width={24} height={24} fill="none" {...props}>
    {/* Sprout stem */}
    <rect x="14.7" y="10" width="2.6" height="7" rx="1.3" fill="currentColor" />
    {/* Left leaf */}
    <ellipse cx="13" cy="12.5" rx="2.2" ry="1.2" fill="currentColor" transform="rotate(-25 13 12.5)" />
    {/* Right leaf */}
    <ellipse cx="19" cy="12.5" rx="2.2" ry="1.2" fill="currentColor" transform="rotate(25 19 12.5)" />
    {/* Patch base */}
    <ellipse cx="16" cy="23.5" rx="10" ry="4.5" fill="currentColor" fillOpacity="0.32" />
  </svg>
);

export const CarrotsIcon = (props: React.SVGProps<SVGSVGElement>) => (
  // Badge carrot icon for # Carrots row
  <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M12 2v5" />
    <path d="M12 7c-1.5 0-3 1.2-3 3 0 2.6 3 6 3 6s3-3.4 3-6c0-1.8-1.5-3-3-3z" />
    <path d="M10 4l2 2 2-2" />
  </svg>
);

export const LogoutIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M16 17l5-5-5-5" />
    <path d="M21 12H9" />
    <path d="M13 5v-2a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v18a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2" />
  </svg>
);

export const SettingsIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width={24} height={24} fill="none" {...props}>
    {/* Gear body */}
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 8.6 15a1.65 1.65 0 0 0-1.82-.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 15 8.6a1.65 1.65 0 0 0 1.82.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 15z" fill="currentColor"/>
    {/* Center circle */}
    <circle cx="12" cy="12" r="3.5" fill="currentColor" />
  </svg>
);

// SearchIcon (vertically center magnifier)
// SearchIcon (vertically center magnifier)
export const SearchIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="11" cy="11" r="7" />
    <line x1="16.5" y1="16.5" x2="21" y2="21" />
  </svg>
);

export const RabbitHoleIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width={24} height={24} fill="none" {...props}>
    {/* Larger, centered tunnel entrance */}
    <ellipse cx="12" cy="12" rx="9" ry="7" fill="currentColor" fillOpacity="0.18" />
    {/* Inner shadow/depth */}
    <ellipse cx="12" cy="12" rx="6.5" ry="4.2" fill="currentColor" fillOpacity="0.32" />
    {/* Deepest point (hole) */}
    <ellipse cx="12" cy="12" rx="3.5" ry="2.2" fill="currentColor" />
    {/* Subtle shadow at base */}
    <ellipse cx="12" cy="18" rx="7" ry="1.2" fill="currentColor" fillOpacity="0.07" />
  </svg>
);

export const SidebarIcons = {
  Home: HomeIcon,
  HomeCustom: HomeIconCustom,
  Notifications: NotificationsIcon,
  NotificationsActive: NotificationsIconActive,
  CarrotPatch: CarrotPatchIcon,
  Groups: GroupsIcon,
  Messages: MessagesIcon,
  Rabbit: RabbitIcon,
  Funds: FundsIcon,
  Carrots: CarrotsIcon,
  Logout: LogoutIcon,
  Settings: SettingsIcon,
  Search: SearchIcon,
  RabbitHole: RabbitHoleIcon,
};
