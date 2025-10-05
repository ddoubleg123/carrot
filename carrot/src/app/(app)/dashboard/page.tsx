
import FirebaseClientInit from './components/FirebaseClientInit';
import '../../../lib/firebase';
import { auth } from '../../../auth';
import { Suspense } from 'react';
import { headers } from 'next/headers';
import type { CommitmentCardProps } from './components/CommitmentCard';
import { redirect } from 'next/navigation';
import DashboardClient from './DashboardClient';
import ClientSessionProvider from './components/ClientSessionProvider';
import MinimalNav from '../../../components/MinimalNav';
import PostModalController from '../../../components/post-modal/PostModalController';
import Widgets from './components/Widgets';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

// Lightweight skeletons to reserve layout and reduce CLS during client-only hydration
function SkeletonBlock({ height = 240 }: { height?: number }) {
  return (
    <div
      className="rounded-2xl border border-gray-200 bg-white/60 animate-pulse"
      style={{ minHeight: height }}
      aria-hidden
    />
  );
}

// Note: dynamic imports with ssr:false are not allowed in Server Components.
// Heavy client components are already split internally where appropriate.

// Server-side data fetching from database
async function getCommitments(): Promise<CommitmentCardProps[]> {
  const prox = (u?: string | null) => (u ? `/api/img?url=${encodeURIComponent(u)}` : null);
  const proxVideo = (u?: string | null) => (u ? `/api/video?url=${encodeURIComponent(u)}` : null);
  const proxArr = (arr?: string[] | string | null) => {
    if (!arr) return [] as string[];
    if (Array.isArray(arr)) return arr.map((u) => prox(u)!).filter(Boolean) as string[];
    try {
      const parsed = JSON.parse(arr);
      return Array.isArray(parsed) ? parsed.map((u) => prox(String(u))!).filter(Boolean) as string[] : [];
    } catch {
      return [] as string[];
    }
  };
  try {
    // Build a base URL from the current request to avoid env mismatch in dev
    const hdrs = await headers();
    const host = hdrs.get('host') || 'carrot-app.onrender.com';
    const isVercel = !!process.env.VERCEL;
    const protocol = isVercel ? 'https' : 'http';
    const baseUrl = `${protocol}://${host}`;
    const response = await fetch(`${baseUrl}/api/posts`, {
      cache: 'no-store', // Always fetch fresh data
    });
    
    if (!response.ok) {
      console.error('Failed to fetch posts from database');
      return [];
    }
    
    const posts = await response.json();
    
    // Get session to use profile photo from session data like composer does
    const session = await auth();
    
    // Transform database posts to CommitmentCardProps format
    return posts.map((post: any) => ({
      id: post.id,
      content: post.content || '',
      carrotText: post.carrotText || '',
      stickText: post.stickText || '',
      author: {
        name: '', // Remove name display per user request
        username: (post.User && post.User.username) || 'daniel', // FIXED: Use actual username from database, not name
        avatar: (post.User && post.User.profilePhoto) || (session?.user as any)?.profilePhoto || (session?.user as any)?.image || '/avatar-placeholder.svg',
        flag: (post.User && post.User.country) || null, // No default country
        id: post.userId, // Add the author ID for ownership comparison
      },
      homeCountry: (post.User && post.User.country) || null, // No default country
      location: {
        zip: '10001',
        city: 'New York',
        state: 'NY',
      },
      stats: {
        likes: Math.floor(Math.random() * 50), // Random likes for demo
        comments: Math.floor(Math.random() * 20),
        reposts: Math.floor(Math.random() * 10),
        views: Math.floor(Math.random() * 200) + 50,
      },
      userVote: null,
      timestamp: post.createdAt,
      imageUrls: proxArr(post.imageUrls),
      gifUrl: prox(post.gifUrl) || null,
      videoUrl: proxVideo(post.videoUrl) || null,
      thumbnailUrl: prox(post.thumbnailUrl) || null,
      // Cloudflare Stream
      cfUid: post.cfUid || post.cf_uid || null,
      cfPlaybackUrlHls: post.cfPlaybackUrlHls || post.cf_playback_url_hls || null,
      captionVttUrl: post.captionVttUrl || post.caption_vtt_url || null,
      audioUrl: post.audioUrl || null,
      audioTranscription: post.audioTranscription || null,
      transcriptionStatus: post.transcriptionStatus || null,
      emoji: post.emoji || '🎯',
      gradientFromColor: post.gradientFromColor || null,
      gradientToColor: post.gradientToColor || null,
      gradientViaColor: post.gradientViaColor || null,
      gradientDirection: post.gradientDirection || null,
    }));
  } catch (error) {
    console.error('Error fetching posts:', error);
    return [];
  }
}

// Add caching for dashboard page
export const revalidate = 60; // Revalidate every minute

export default async function DashboardPage() {
  const session = await auth();
  
  if (!session) {
    redirect('/login');
  }

  const commitments = await getCommitments();

  return (
    <Suspense fallback={
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    }>
      <div className={`min-h-screen flex ${inter.className}`} style={{ marginTop: -20, paddingTop: 0 }}>
        {/* Left nav: fixed width, stays in-flow */}
        <aside className="w-20 shrink-0 sticky top-0 self-start h-screen bg-gray-50 border-r border-gray-200">
          <MinimalNav />
        </aside>

        {/* Main content area with feed and right rail */}
        <main className="flex-1 min-w-0 flex">
          {/* Feed column - positioned close to nav */}
          <div className="w-full min-w-[320px] max-w-[720px] px-6">
            <FirebaseClientInit />
            <ClientSessionProvider>
              {/* Client dashboard (hydrated in client file) */}
              <DashboardClient initialCommitments={commitments} isModalComposer={true} />
              {/* Global controller that mounts the Post Modal when ?modal=1&post=ID */}
              <PostModalController />
            </ClientSessionProvider>
          </div>
          
          {/* Right rail / Third column (hidden on small screens) */}
          <aside className="hidden lg:block w-80 shrink-0 px-4 py-6">
            <Widgets />
          </aside>
        </main>
      </div>
    </Suspense>
  );
}
