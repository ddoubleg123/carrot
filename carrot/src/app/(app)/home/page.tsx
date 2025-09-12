import FirebaseClientInit from '../dashboard/components/FirebaseClientInit';
import '../../../lib/firebase';
import { Suspense } from 'react';
import type { CommitmentCardProps } from '../dashboard/components/CommitmentCard';
import { redirect } from 'next/navigation';
import DashboardClient from '../dashboard/DashboardClient';
import PostModalController from '../../../components/post-modal/PostModalController';
import ClientSessionProvider from '../dashboard/components/ClientSessionProvider';
import MinimalNav from '../../../components/MinimalNav';
import Widgets from '../dashboard/components/Widgets';
import { Inter } from 'next/font/google';
import { headers as nextHeaders, cookies as nextCookies } from 'next/headers';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const inter = Inter({ subsets: ['latin'] });

// Server-side data fetching from database (same mapping as dashboard)
async function getCommitments(): Promise<CommitmentCardProps[]> {
  try {
    // In dev mock mode, skip server fetch entirely and let the client inject a mock post
    if (process.env.NEXT_PUBLIC_USE_MOCK_FEED === '1') {
      return [];
    }
    // Forward cookies to preserve session auth when calling API from a server component
    const h = await nextHeaders();
    const cookieHeader = h.get('cookie') || '';
    // Optional: confirm session (not strictly required here)
    try {
      const sres = await fetch(`/api/auth/session`, { headers: { Cookie: cookieHeader }, cache: 'no-store' });
      if (!sres.ok) {
        try { console.warn('[home] session check failed', sres.status); } catch {}
      }
    } catch {}
    const response = await fetch(`/api/posts`, {
      headers: { 'Cookie': cookieHeader },
      cache: 'no-store',
    });
    
    if (!response.ok) {
      // Avoid noisy stack in dev when DB is intentionally unavailable
      if (process.env.NODE_ENV !== 'production') {
        try { console.warn('Error fetching /api/posts (suppressed):', response.status); } catch {}
      }
      return [];
    }
    const posts = await response.json();
    return posts.map((post: any) => {
      // Prefer durable storage path via proxy to ensure same-origin
      const p = post.User || {};
      const proxiedFromPath = p.profilePhotoPath ? `/api/img?path=${encodeURIComponent(p.profilePhotoPath)}` : null;
      const proxiedFromUrl = p.profilePhoto && /^https?:\/\//i.test(p.profilePhoto)
        ? `/api/img?url=${encodeURIComponent(p.profilePhoto)}`
        : null;
      const avatar = proxiedFromPath || proxiedFromUrl || '/avatar-placeholder.svg';
      return ({
      id: post.id,
      content: post.content || '',
      carrotText: post.carrotText || '',
      stickText: post.stickText || '',
      author: {
        name: '',
        username: post.User?.username || 'daniel',
        avatar,
        flag: undefined,
        id: post.userId,
      },
      homeCountry: post.User?.country || null,
      location: { zip: '10001', city: 'New York', state: 'NY' },
      stats: {
        likes: Math.floor(Math.random() * 50),
        comments: Math.floor(Math.random() * 20),
        reposts: Math.floor(Math.random() * 10),
        views: Math.floor(Math.random() * 200) + 50,
      },
      userVote: null,
      timestamp: post.createdAt,
      imageUrls: post.imageUrls ? (typeof post.imageUrls === 'string' ? JSON.parse(post.imageUrls) : post.imageUrls) : [],
      gifUrl: post.gifUrl || null,
      videoUrl: post.videoUrl || null,
      thumbnailUrl: post.thumbnailUrl || null,
      audioUrl: post.audioUrl || null,
      audioTranscription: post.audioTranscription || null,
      transcriptionStatus: post.transcriptionStatus || null,
      emoji: post.emoji || '🎯',
      gradientFromColor: post.gradientFromColor || null,
      gradientToColor: post.gradientToColor || null,
      gradientViaColor: post.gradientViaColor || null,
      gradientDirection: post.gradientDirection || null,
    });
    });
  } catch (e) {
    console.error('Error fetching posts for /home:', e);
    return [];
  }
}

export default async function HomePage() {
  // First try auth() via dynamic import
  let session: any = null;
  try {
    const mod: any = await import('../../../auth');
    const authFn: any = typeof mod?.auth === 'function' ? mod.auth : (typeof mod?.default?.auth === 'function' ? mod.default.auth : null);
    if (authFn) {
      session = await authFn();
      if (process.env.NODE_ENV !== 'production') {
        try { console.log('[home] auth() result user?', !!session?.user); } catch {}
      }
    }
  } catch {}
  // Fallback to session endpoint with forwarded cookies
  if (!session?.user) {
    const h = await nextHeaders();
    const cookieHeader = h.get('cookie') || '';
    try {
      const sres = await fetch(`/api/auth/session`, { headers: { 'cookie': cookieHeader }, cache: 'no-store' });
      if (sres.ok) session = await sres.json().catch(() => null);
      if (process.env.NODE_ENV !== 'production') {
        try { console.log('[home] session fetch status', sres.status); } catch {}
      }
    } catch {}
  }
  // As a final guard, check for presence of NextAuth session cookie to avoid false negatives
  if (!session?.user) {
    const c = await nextCookies();
    const hasCookie = Boolean(
      c.get('next-auth.session-token')?.value ||
      c.get('__Secure-next-auth.session-token')?.value ||
      c.get('authjs.session-token')?.value ||
      c.get('__Secure-authjs.session-token')?.value
    );
    if (process.env.NODE_ENV !== 'production') {
      try { console.log('[home] cookie presence', hasCookie); } catch {}
    }
    if (!hasCookie) {
      redirect('/login');
    }
  }

  const commitments = await getCommitments();
  // Fetch server-backed playback prefs using the same session cookie
  let serverPrefs: { reducedMotion: boolean; captionsDefault: boolean; autoplay?: boolean } | undefined;
  try {
    const h2 = await nextHeaders();
    const cookieHeader2 = h2.get('cookie') || '';
    const resp = await fetch(`/api/user/prefs`, { headers: { Cookie: cookieHeader2 }, cache: 'no-store' });
    if (resp.ok) {
      const j = await resp.json();
      serverPrefs = {
        reducedMotion: Boolean(j?.reducedMotion),
        captionsDefault: j?.captionsDefault === true || j?.captionsDefault === 'on',
        autoplay: typeof j?.autoplay === 'boolean' ? j.autoplay : undefined,
      };
    }
  } catch {}

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
            <Widgets />
          </aside>
        </main>
      </div>
    </Suspense>
  );
}
