import FirebaseClientInit from '../dashboard/components/FirebaseClientInit';
import { Suspense } from 'react';
import type { CommitmentCardProps } from '../dashboard/components/CommitmentCard';
import DashboardClient from '../dashboard/DashboardClient';
import PostModalController from '../../../components/post-modal/PostModalController';
import ClientSessionProvider from '../dashboard/components/ClientSessionProvider';
import MinimalNav from '../../../components/MinimalNav';
import Widgets from '../dashboard/components/Widgets';
import FeedDebugger from '../../../components/debug/FeedDebugger';
import VideoLoadingDiagnostics from '../../../components/debug/VideoLoadingDiagnostics';
import NetworkPerformanceMonitor from '../../../components/debug/NetworkPerformanceMonitor';
import { Inter } from 'next/font/google';
import { headers as nextHeaders, cookies as nextCookies } from 'next/headers';
export const dynamic = 'force-dynamic';
export const revalidate = 60; // Revalidate every minute

const inter = Inter({ subsets: ['latin'] });

// Server-side data fetching from database (same mapping as dashboard)
async function getCommitments(): Promise<CommitmentCardProps[]> {
  try {
    // Simplified: return empty list to avoid SSR build issues
    return [];
  } catch {
    return [];
  }
}

export default async function HomePage() {
  try {
    // Gate by cookie presence only (avoid SSR auth imports/fetches)
    // In Next.js 15+, cookies() is called synchronously but accessed asynchronously
    const cookieStore = await nextCookies();
    const hasCookie = Boolean(
      cookieStore.get('next-auth.session-token')?.value ||
      cookieStore.get('__Secure-next-auth.session-token')?.value ||
      cookieStore.get('authjs.session-token')?.value ||
      cookieStore.get('__Secure-authjs.session-token')?.value
    );
    if (!hasCookie) {
      return (
        <div className="min-h-screen flex items-center justify-center p-10">
          <div className="bg-white rounded-xl shadow p-8 text-center space-y-4">
            <h1 className="text-xl font-semibold">Sign in to view your home feed</h1>
            <a href="/login" className="inline-block px-4 py-2 rounded bg-black text-white">Go to Login</a>
          </div>
        </div>
      );
    }

    // Load data (currently simplified to empty)
    const commitments = await getCommitments();
    const serverPrefs: { reducedMotion: boolean; captionsDefault: boolean; autoplay?: boolean } | undefined = undefined;

    return (
      <Suspense fallback={
        <div className="flex justify-center items-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      }>
        <div className={`min-h-screen flex ${inter.className}`}>
          {/* Left nav */}
          <aside className="w-20 shrink-0 sticky top-0 self-start h-screen bg-gray-50 border-r border-gray-200">
            <MinimalNav />
          </aside>

          {/* Main content area */}
          <main className="flex-1 min-w-0 flex">
            {/* Feed column */}
            <div className="w-full min-w-[320px] max-w-[720px] px-6" style={{ marginTop: -20, paddingTop: 0 }}>
              <FirebaseClientInit />
              <ClientSessionProvider>
                <DashboardClient initialCommitments={commitments} isModalComposer={true} serverPrefs={serverPrefs} />
                {/* Global controller that mounts the Post Modal when ?modal=1&post=ID */}
                <PostModalController />
              </ClientSessionProvider>
            </div>

            {/* Right rail (hidden on small screens) */}
            <aside className="hidden lg:block w-80 shrink-0 px-4 py-6">
              <div className="space-y-6">
                <Widgets />
                <FeedDebugger />
                <VideoLoadingDiagnostics
                  videoUrl={commitments.find((p: any) => p.videoUrl)?.videoUrl || ''}
                  postId={commitments.find((p: any) => p.videoUrl)?.id || ''}
                />
                <NetworkPerformanceMonitor />
              </div>
            </aside>
          </main>
        </div>
      </Suspense>
    );
  } catch (e: any) {
    return (
      <div className="min-h-screen flex items-center justify-center p-10">
        <div className="bg-white rounded-xl shadow p-8 text-center space-y-4">
          <h1 className="text-xl font-semibold">Home failed to load</h1>
          <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-48">{e?.message || String(e)}</pre>
          <div className="flex gap-2 justify-center">
            <a href="/home" className="inline-block px-4 py-2 rounded bg-black text-white">Retry</a>
            <a href="/login" className="inline-block px-4 py-2 rounded border">Login</a>
          </div>
        </div>
      </div>
    );
  }
}
