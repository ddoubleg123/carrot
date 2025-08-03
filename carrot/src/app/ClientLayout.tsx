'use client';

import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import WindsurfAttributes from '../components/WindsurfAttributes';
import dynamic from 'next/dynamic';

// Dynamically import Sidebar to avoid SSR issues with usePathname
const Sidebar = dynamic(() => import('@/components/Sidebar/Sidebar'), {
  ssr: false,
});

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const isAuthPage = pathname?.startsWith('/auth');
  const isLoginPage = pathname === '/login';
  const isPublicPage = pathname === '/' || pathname?.startsWith('/about') || isLoginPage;
  const isAuthenticated = status === 'authenticated';
  const isLoading = status === 'loading';

  // Do not render anything while session is loading
  if (status === 'loading') {
    return null; // or a spinner if you want
  }

  // Only render sidebar for authenticated users
  if (isAuthenticated) {
    return (
      <>
        <WindsurfAttributes />
        <Sidebar />
        <main className="min-h-screen bg-gray-50">{children}</main>
      </>
    );
  }

  // For all other pages (including unauthenticated), render only main content
  return (
    <>
      <WindsurfAttributes />
      <main className="min-h-screen bg-gray-50">{children}</main>
    </>
  );
}
