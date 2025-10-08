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
  // Simplified version to debug 500 error
  // Remove try-catch temporarily to see actual error
  
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
}
