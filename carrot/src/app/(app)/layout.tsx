import ClientSessionProvider from './dashboard/components/ClientSessionProvider';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Simplified layout to debug 500 error - temporarily bypass all auth logic
  
  return (
    <ClientSessionProvider>
      <main className="flex-1 min-h-screen bg-gray-50">{children}</main>
    </ClientSessionProvider>
  );
}
