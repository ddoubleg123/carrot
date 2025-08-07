import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { ADMIN_USERS } from '@/config/auth';

export default async function PortalPage() {
  const session = await auth();
  if (!session || !session.user?.email || !ADMIN_USERS.includes(session.user.email)) {
    redirect('/login');
  }
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <h1 className="text-3xl font-bold mb-4">Admin Portal</h1>
      <p className="mb-2">Welcome, {session.user.email}!</p>
      <p className="text-gray-500">Onboarding status: {String(session.user.isOnboarded)}</p>
      {/* Admin panel content goes here */}
    </main>
  );
}
