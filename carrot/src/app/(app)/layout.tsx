import { auth } from '@/auth';
import Sidebar from '@/components/Sidebar/Sidebar';
import { redirect } from 'next/navigation';
import { SessionProvider } from 'next-auth/react';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  return (
    <>
      <Sidebar />
      <main className="flex-1 min-h-screen bg-gray-50">{children}</main>
    </>
  );
}
