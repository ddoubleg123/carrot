
import { redirect } from 'next/navigation';
import { auth } from '../../../auth';
import ClientSessionProvider from '../dashboard/components/ClientSessionProvider';
import '../dashboard/dashboard-layout.css';


export default async function DashboardTestLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) {
    redirect('/login');
  }

  return (
    <ClientSessionProvider>
      <div className={`min-h-screen bg-gray-50/30 font-sans`}>
        {children}
      </div>
    </ClientSessionProvider>
  );
}
