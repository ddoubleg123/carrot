
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
import Widgets from './components/Widgets';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

// Server-side data fetching from database
async function getCommitments(): Promise<CommitmentCardProps[]> {
  try {
    // Build a base URL from the current request to avoid env mismatch in dev
    const hdrs = headers();
    const host = hdrs.get('host') || 'localhost:3005';
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
    
    // Transform database posts to CommitmentCardProps format
    return posts.map((post: any) => ({
      id: post.id,
      content: post.content || '',
      carrotText: post.carrotText || '',
      stickText: post.stickText || '',
      author: {
        name: '', // Remove name display per user request
        username: post.User?.username || 'daniel', // FIXED: Use actual username from database, not name
        avatar: post.User?.profilePhoto || post.User?.image || 'https://firebasestorage.googleapis.com/v0/b/involuted-river-466315-p0.firebasestorage.app/o/users%2Fcmdm0m8pl00004sbcjr0i6vjg%2Fstaged%2Fe137a64b-9b76-4127-a4c0-5fb2cd4c3176%2F9e257b08-4682-4ab1-839a-5ab2298e3084.png?alt=media&token=a06d95fc-1656-42af-a36f-b9a3349d4239',
        flag: '🇺🇸',
        id: post.userId, // Add the author ID for ownership comparison
      },
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
      imageUrls: (() => {
        if (!post.imageUrls) return [];
        if (Array.isArray(post.imageUrls)) return post.imageUrls;
        if (typeof post.imageUrls === 'string') {
          try {
            const parsed = JSON.parse(post.imageUrls);
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        }
        return [];
      })(),
      gifUrl: post.gifUrl || null,
      videoUrl: post.videoUrl || null,
      thumbnailUrl: post.thumbnailUrl || null,
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
              <DashboardClient initialCommitments={commitments} isModalComposer={true} />
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
