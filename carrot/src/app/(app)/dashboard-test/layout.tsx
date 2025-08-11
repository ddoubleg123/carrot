import { Inter } from 'next/font/google';
import { redirect } from 'next/navigation';
import { auth } from '../../../auth';
import ClientSessionProvider from '../dashboard/components/ClientSessionProvider';
import ModernHeader from './components/ModernHeader';
import Widgets from '../dashboard/components/Widgets';
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
        {/* MODERN FIXED HEADER */}
        <ModernHeader />

        {/* MAIN CONTENT AREA - Replicate exact working dashboard structure */}
        <div className="pt-16"> {/* Account for fixed header height */}
          <div className={`flex w-full max-w-[1400px] mx-auto px-4 sm:px-6 gap-6`}>
            
            {/* CENTER FEED - Clean alternative dashboard */}
            <main className="w-[650px] flex-shrink-0" style={{ width: '650px !important', maxWidth: '650px !important' }}>
              {children}
            </main>

            {/* RIGHT SIDEBAR - Same structure as working dashboard */}
            <aside className="hidden min-[1200px]:block w-[300px] flex-shrink-0 sticky top-20 h-screen overflow-y-auto">
              <Widgets />
            </aside>
          </div>
        </div>
      </div>
    </ClientSessionProvider>
  );
}
