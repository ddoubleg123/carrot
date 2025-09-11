import { redirect } from 'next/navigation';
import { auth } from '../../auth';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session: any = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  // Check if user needs onboarding
  if (session.user && !session.user.isOnboarded) {
    redirect('/onboarding');
  }

  return (
    <main className="flex-1 min-h-screen bg-gray-50">{children}</main>
  );
}
