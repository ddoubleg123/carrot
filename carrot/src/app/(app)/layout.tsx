import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Use dynamic imports to avoid edge bundler/type-resolution pitfalls
  const { getServerSession } = await import('next-auth');
  const authMod: any = await import('../../auth');
  const session: any = await getServerSession(authMod.authOptions);

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
