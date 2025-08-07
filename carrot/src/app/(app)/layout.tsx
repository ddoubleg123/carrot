import { auth } from '../../auth';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  return (
    <main className="flex-1 min-h-screen bg-gray-50">{children}</main>
  );
}
