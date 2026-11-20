import { Inter } from 'next/font/google';
import { redirect } from 'next/navigation';
import { auth } from '../../../auth';
import ClientSessionProvider from '../dashboard/components/ClientSessionProvider';
import MinimalNav from '../../../components/MinimalNav';
import '../dashboard/dashboard-layout.css';

const inter = Inter({ subsets: ['latin'] });

export default async function Layout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) {
    redirect('/login');
  }

  return (
    <ClientSessionProvider>
      <div className={`min-h-screen flex bg-white ${inter.className}`}>
        {/* Left nav: gray stops at this rail */}
        <aside className="w-20 shrink-0 sticky top-0 self-start h-screen bg-gray-50 border-r border-gray-200">
          <MinimalNav />
        </aside>

        {/* Main content area */}
        <main className="flex-1 min-w-0 min-h-screen bg-white">
          <div className="w-full min-w-[320px] px-6">
            {children}
          </div>
        </main>
      </div>
    </ClientSessionProvider>
  );
}
