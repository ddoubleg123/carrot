import { Inter } from 'next/font/google';
import { redirect } from 'next/navigation';
import { auth } from '../../../auth';
import ClientSessionProvider from '../dashboard/components/ClientSessionProvider';
import '../dashboard/dashboard-layout.css';

const inter = Inter({ subsets: ['latin'] });

export default async function DashboardTestLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) {
    redirect('/login');
  }

  return (
    <ClientSessionProvider>
      <div className={`min-h-screen bg-gray-50/30 ${inter.className}`}>
        {children}
      </div>
    </ClientSessionProvider>
  );
}
