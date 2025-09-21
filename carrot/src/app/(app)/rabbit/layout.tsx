import { Inter } from 'next/font/google';
import { redirect } from 'next/navigation';
import { auth } from '../../../auth';
import ClientSessionProvider from '../dashboard/components/ClientSessionProvider';
import MinimalNav from '../../../components/MinimalNav';
import { Suspense } from 'react';

const inter = Inter({ subsets: ['latin'] });

export default async function RabbitLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) {
    redirect('/login');
  }

  return (
    <Suspense fallback={
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    }>
      <div className={`min-h-screen flex ${inter.className}`}>
        {/* Left nav - same as home page */}
        <aside className="w-20 shrink-0 sticky top-0 self-start h-screen bg-gray-50 border-r border-gray-200">
          <MinimalNav />
        </aside>

        {/* Main content area */}
        <main className="flex-1 min-w-0">
          {/* Rabbit content column - full width */}
          <div className="w-full px-6" style={{ marginTop: -20, paddingTop: 0 }}>
            <ClientSessionProvider>
              {children}
            </ClientSessionProvider>
          </div>
        </main>
      </div>
    </Suspense>
  );
}
