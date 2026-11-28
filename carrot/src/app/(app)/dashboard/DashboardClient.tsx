'use client';

import { Fragment, useState, useEffect, useLayoutEffect, useRef, useCallback, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import CommitmentCard, { CommitmentCardProps, VoteType } from './components/CommitmentCard';
import COLOR_SCHEMES from '../../../config/colorSchemes';
import dynamic from 'next/dynamic';
import ComposerTrigger from '../../../components/ComposerTrigger';
import { useState as useModalState } from 'react';
import Toast from './components/Toast';
import { VideoProvider } from '../../../context/VideoContext';
import { FeedRectangle } from '@/components/search/HalfPageAd';
import LiveFeedCard, { pickFeedLives, subscribeRail } from '@/components/live/LiveFeedCard';
import type { RailItem } from '@/lib/live/now';

export interface DashboardCommitmentCardProps extends Omit<CommitmentCardProps, 'onVote' | 'onToggleBookmark'> {
  // Add any additional props specific to Dashboard if needed
}

interface DashboardClientProps {
  initialCommitments: DashboardCommitmentCardProps[];
  isModalComposer?: boolean;
  serverPrefs?: { reducedMotion?: boolean; captionsDefault?: boolean; autoplay?: boolean };
}

import { useSyncFirebaseAuth } from '../../../lib/useSyncFirebaseAuth';

// Minimal skeletons to reserve space during client-only hydration
function SkeletonComposer() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white/70 animate-pulse" style={{ minHeight: 220 }} aria-hidden />
  );
}

const ComposerDynamic = dynamic(() => import('./components/CommitmentComposer'), {
  ssr: false,
  loading: () => <SkeletonComposer />,
});

const ComposerModalDynamic = dynamic(() => import('../../../components/ComposerModal'), {
  ssr: false,
  loading: () => null,
});

let feedRequest: Promise<any[] | null> | null = null;

const FEED_CACHE_KEY = 'carrot-home-feed-v11';

function readFeedCache(): any[] | null {
  try {
    const raw = localStorage.getItem(FEED_CACHE_KEY) || sessionStorage.getItem(FEED_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

function writeFeedCache(posts: any[]) {
  try {
    const slim = posts.slice(0, 15).map((post) => ({
      ...post,
      thumbnailUrl: typeof post?.thumbnailUrl === 'string' && post.thumbnailUrl.startsWith('data:') && post.thumbnailUrl.length > 200_000 ? null : post?.thumbnailUrl,
      imageUrls: Array.isArray(post?.imageUrls)
        ? post.imageUrls.filter((url: string) => typeof url === 'string' && !url.startsWith('data:'))
        : post?.imageUrls,
    }));
    const raw = JSON.stringify(slim);
    localStorage.setItem(FEED_CACHE_KEY, raw);
    sessionStorage.setItem(FEED_CACHE_KEY, raw);
  } catch {
    // A full cache is optional. The network response still paints the feed.
  }
}

function fetchFeedOnce(): Promise<any[] | null> {
  if (feedRequest) return feedRequest;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 30000);
  feedRequest = fetch('/api/posts', { cache: 'no-cache', signal: controller.signal, keepalive: false })
    .then((res) => (res.ok ? res.json() : null))
    .catch(() => null)
    .finally(() => {
      window.clearTimeout(timer);
      feedRequest = null;
    });
  return feedRequest;
}

function hasQuotePhoto(post: { content?: string | null; imageUrls?: string[] | null }): boolean {
  if (!/^kind:\s*quote\b/im.test(post.content || '')) return true
  return Array.isArray(post.imageUrls) && post.imageUrls.some(Boolean)
}

function forHome<T extends { author?: { id?: string | null } | null; userId?: string | null; repostedBy?: string | null }>(posts: T[], viewerId?: string | null): T[] {
  if (!viewerId) return posts
  return posts.filter((post) => {
    const author = post.author?.id || post.userId
    if (!author || author !== viewerId) return true
    const by = String(post.repostedBy || '').trim()
    return Boolean(by) && by !== viewerId
  })
}

function unstacked<T extends { author?: { id?: string | null } | null }>(posts: T[]): T[] {
  const pending = posts.filter(hasQuotePhoto)
  const out: T[] = []
  while (pending.length) {
    const last = out[out.length - 1]?.author?.id
    let index = pending.findIndex((post) => !last || post.author?.id !== last)
    if (index < 0) index = 0
    out.push(pending.splice(index, 1)[0])
  }
  return out
}

function feedLiveSlot(index: number): number {
  if (index % 6 !== 0) return -1
  return index / 6
}

function DwellMark({ postId, children }: { postId: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef<number | null>(null);
  const sent = useRef(false);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const send = (ms: number) => {
      if (sent.current) return;
      sent.current = true;
      fetch('/api/feed/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, ms })
      }).catch(() => {});
    };
    let timer: number | null = null;
    const clearTimer = () => {
      if (timer == null) return;
      window.clearTimeout(timer);
      timer = null;
    };
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      if (entry.isIntersecting && entry.intersectionRatio >= 0.15) {
        if (started.current == null) started.current = Date.now();
        if (timer == null) {
          timer = window.setTimeout(() => {
            timer = null;
            if (started.current != null) send(Date.now() - started.current);
          }, 800);
        }
        return;
      }
      clearTimer();
      if (started.current != null) {
        send(Date.now() - started.current);
        started.current = null;
      }
    }, { threshold: [0, 0.15, 0.6] });
    observer.observe(node);
    return () => {
      clearTimer();
      if (started.current != null) send(Date.now() - started.current);
      observer.disconnect();
    };
  }, [postId]);
  return <div ref={ref}>{children}</div>;
}

export default function DashboardClient({ initialCommitments, isModalComposer = false, serverPrefs }: DashboardClientProps) {
  useSyncFirebaseAuth();
  const [commitments, setCommitments] = useState<DashboardCommitmentCardProps[]>(initialCommitments);
  const [feedNote, setFeedNote] = useState<'loading' | 'failed' | ''>(initialCommitments.length > 0 ? '' : 'loading');
  const [freshPosts, setFreshPosts] = useState<DashboardCommitmentCardProps[]>([]);
  const [liveShows, setLiveShows] = useState<RailItem[]>([]);
  const [visiblePostCount, setVisiblePostCount] = useState(5); // CRITICAL FIX: Only render first 5 posts initially
  const [isModalOpen, setIsModalOpen] = useModalState(false);
  const { data: session } = useSession();
  const router = useRouter();

  // Toast state (reuse same UX as ComposerModal)
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');
  const [showToast, setShowToast] = useState(false);
  const showSuccessToast = (msg: string) => { setToastMessage(msg); setToastType('success'); setShowToast(true); };
  const showErrorToast = (msg: string) => { setToastMessage(msg); setToastType('error'); setShowToast(true); };

  useEffect(() => subscribeRail((snap) => {
    setLiveShows(pickFeedLives(snap.items))
  }), [])

  // Register media Service Worker for HLS/segment prefetch when flagged
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (process.env.NEXT_PUBLIC_MEDIA_SW !== '1') return;
    if (!('serviceWorker' in navigator)) return;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw-media.js', { scope: '/' });
        // Wait for activation in background; no UI side effects
        if (reg.installing) {
          reg.installing.addEventListener('statechange', () => {});
        }
      } catch {
        // Silent: SW is optional
      }
    })();
  }, []);

  // CRITICAL FIX: Implement lazy loading with intersection observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const postIndex = parseInt(entry.target.getAttribute('data-post-index') || '0');
            if (postIndex >= visiblePostCount - 2) { // Load more when reaching 2 posts from the end
              setVisiblePostCount(prev => Math.min(prev + 3, commitments.length)); // Load 3 more posts
            }
          }
        });
      },
      { threshold: 0.1, rootMargin: '1200px' }
    );

    // Observe all posts
    const postElements = document.querySelectorAll('[data-post-index]');
    postElements.forEach(el => observer.observe(el));

    return () => observer.disconnect();
  }, [visiblePostCount, commitments.length]);

  const realCount = (post: any, key: 'likes' | 'comments') => {
    const fromRelation = post?._count?.[key];
    if (typeof fromRelation === 'number') return fromRelation;
    const direct = post?.[key];
    if (typeof direct === 'number') return direct;
    const fromStats = post?.stats?.[key];
    return typeof fromStats === 'number' ? fromStats : 0;
  };

  // Normalize server DB post -> CommitmentCardProps used by the feed
  const mapServerPostToCard = (post: any): DashboardCommitmentCardProps => {
    // Add debugging for posts with missing user data
    if (!post?.User && process.env.NODE_ENV !== 'production') {
      console.warn('[DashboardClient] Post missing User data:', { postId: post?.id, post });
    }
    const prox = (u?: string | null) => {
      if (!u) return null;
      // If already proxied, return as-is
      if (u.startsWith('/api/img') || u.startsWith('/curator-thumbs/') || u.startsWith('/curator-avatars/')) {
        return u;
      }
      
      // For data URIs (base64 images), use them directly - no proxy needed
      if (u.startsWith('data:')) {
        console.log('[prox] ✓ DIRECT DATA URI (no proxy):', u.substring(0, 80));
        return u;
      }
      
      // For Firebase Storage URLs with signed tokens, use them directly (no proxy needed)
      if (u.includes('firebasestorage.googleapis.com') || u.includes('.appspot.com')) {
        try {
          const urlObj = new URL(u);
          // Check if URL has a valid token - if so, it's already signed and public
          if (urlObj.searchParams.has('token') || urlObj.searchParams.has('X-Goog-Signature')) {
            console.log('[prox] ✓ DIRECT FIREBASE URL (has token):', u.substring(0, 100));
            return u; // Use directly, no proxy needed
          }
        } catch (e) {
          console.warn('[prox] Failed to parse URL:', u);
        }
      }
      
      // CRITICAL FIX: Never proxy data URIs - they should be used directly
      if (u.startsWith('data:')) {
        console.log('[prox] Using data URI directly (should not be proxied):', u.substring(0, 100));
        return u;
      }
      
      // For URLs without tokens or other sources, proxy them
      const isAlreadyEncoded = /%25[0-9A-Fa-f]{2}/.test(u);
      const proxied = `/api/img?url=${isAlreadyEncoded ? u : encodeURIComponent(u)}`;
      console.log('[prox] Proxying URL:', { original: u.substring(0, 80), proxied: proxied.substring(0, 100) });
      return proxied;
    };
    const proxVideo = (u?: string | null) => {
      if (!u) return null;
      
      // VALIDATION: Check for valid video formats
      const VALID_VIDEO_FORMATS = /\.(mp4|webm|mov|m4v|avi|mkv|ogg|ogv)(\?|$)/i;
      const VALID_VIDEO_MIME_TYPES = /^(video\/|application\/x-mpegURL|application\/vnd\.apple\.mpegurl)/i;
      
      // CRITICAL FIX: If already proxied, return as-is (prevent double-proxying)
      if (u.startsWith('/api/video')) {
        console.log('[proxVideo] URL already proxied, returning as-is:', u.substring(0, 100));
        return u;
      }

      if (u.startsWith('/topic-videos/') && !u.includes('..')) {
        return u;
      }
      
      // Check if it's a data URI with video MIME type
      if (u.startsWith('data:')) {
        if (!VALID_VIDEO_MIME_TYPES.test(u)) {
          console.warn('[proxVideo] ⚠️ Invalid data URI - not a video MIME type:', u.substring(0, 100));
          return null;
        }
        console.log('[proxVideo] ✓ Valid video data URI, using directly');
        return u;
      }
      
      // CRITICAL FIX: For Firebase Storage URLs, prefer direct usage to avoid proxy issues
      if (u.includes('firebasestorage.googleapis.com') || u.includes('.appspot.com')) {
        try {
          const urlObj = new URL(u);
          // Check if URL has a valid token parameter - if so, it's already signed and public
          if (urlObj.searchParams.has('token') || urlObj.searchParams.has('X-Goog-Signature') || urlObj.searchParams.has('alt')) {
            console.log('[proxVideo] ✓ DIRECT FIREBASE URL (has token/alt):', u.substring(0, 100));
            return u; // Use directly, no proxy needed
          }
          
          // For unsigned Firebase URLs, add alt=media and use directly
          if (!urlObj.searchParams.has('alt')) {
            urlObj.searchParams.set('alt', 'media');
            const directUrl = urlObj.toString();
            console.log('[proxVideo] ✓ DIRECT FIREBASE URL (added alt=media):', directUrl.substring(0, 100));
            return directUrl;
          }
        } catch (e) {
          console.warn('[proxVideo] Failed to parse Firebase URL:', u);
        }
        
        // Fallback: proxy it if we can't parse it
        console.log('[proxVideo] Proxying Firebase URL (fallback):', u.substring(0, 100));
      }
      
      // Validate video format for direct URLs
      if (!u.startsWith('http://') && !u.startsWith('https://') && !u.startsWith('/')) {
        console.warn('[proxVideo] ⚠️ Invalid URL format:', u.substring(0, 100));
        return null;
      }
      
      // Check for valid video extension
      if (!VALID_VIDEO_FORMATS.test(u) && !u.includes('firebasestorage')) {
        console.warn('[proxVideo] ⚠️ Invalid video format - no valid extension found:', {
          url: u.substring(0, 100),
          hint: 'Expected: .mp4, .webm, .mov, .m4v, .avi, .mkv, .ogg, .ogv'
        });
        return null;
      }
      
      // CRITICAL FIX: Use simple proxy without complex encoding
      const proxied = `/api/video?url=${encodeURIComponent(u)}`;
      console.log('[proxVideo] Proxying URL:', { original: u.substring(0, 80), proxied: proxied.substring(0, 100) });
      return proxied;
    };
    const proxPath = (p?: string | null) => (p ? `/api/img?path=${encodeURIComponent(p)}` : null);
    const imageUrls = (() => {
      if (!post?.imageUrls) return [] as string[];
      if (Array.isArray(post.imageUrls)) return post.imageUrls.map((u: string) => prox(u)!).filter(Boolean) as string[];
      if (typeof post.imageUrls === 'string') {
        try {
          const parsed = JSON.parse(post.imageUrls);
          return Array.isArray(parsed) ? parsed.map((u: string) => prox(String(u))!).filter(Boolean) as string[] : [];
        } catch {
          return [] as string[];
        }
      }
      return [] as string[];
    })();
    // Fallback: if no imageUrls but thumbnailUrl exists, use it as a single image
    const imageUrlsFinal = (imageUrls && imageUrls.length > 0)
      ? imageUrls
      : (post?.thumbnailUrl ? [prox(post.thumbnailUrl)!].filter(Boolean) as string[] : []);
    // Determine gradient defaults if missing, based on a deterministic hash of post.id
    const schemeIndex = (() => {
      try {
        const s = String(post?.id || post?.cfUid || Date.now());
        let h = 0;
        for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
        return h % COLOR_SCHEMES.length;
      } catch { return 0; }
    })();
    const fallbackScheme = COLOR_SCHEMES[schemeIndex] || COLOR_SCHEMES[0];

    // Resolve avatar with preference: user.profilePhotoPath -> user.profilePhoto URL -> session user avatar -> placeholder
    const userObj = post?.User || {};
    // For avatars, avoid proxying Google-hosted URLs via /api/img to prevent host allowlist blocks
    const avatarFromPath = proxPath(userObj?.profilePhotoPath);
    const avatarFromUrlRaw = userObj?.profilePhoto ? String(userObj.profilePhoto) : (userObj?.image ? String(userObj.image) : null);
    const sessionAvatarRaw = (session?.user as any)?.profilePhoto || (session?.user as any)?.image || null;
    const finalAvatar = avatarFromPath || avatarFromUrlRaw || sessionAvatarRaw || '/avatar-placeholder.svg';

    // Username: prefer DB user.username, else session username/email local-part, else 'user'
    const sessionUsername = (session?.user as any)?.username || ((session?.user as any)?.email ? String((session?.user as any).email).split('@')[0] : null);
    const finalUsername = (userObj?.username && String(userObj.username).trim()) || sessionUsername || 'user';

    const mapped = {
      id: post.id,
      content: post.content || '',
      carrotText: post.carrotText || '',
      stickText: post.stickText || '',
      author: {
        name: String(userObj?.name || '').trim(),
        username: String(finalUsername || 'user'),
        avatar: String(finalAvatar || '/avatar-placeholder.svg'),
        flag: userObj?.country || (session?.user as any)?.country || null,
        id: String(post.userId || 'unknown'),
      },
      homeCountry: userObj?.country || (session?.user as any)?.country || null,
      location: { zip: '10001', city: 'New York', state: 'NY' },
      stats: {
        likes: realCount(post, 'likes'),
        comments: realCount(post, 'comments'),
        reposts: typeof post?.reposts === 'number' ? post.reposts : 0,
        views: typeof post?.views === 'number' ? post.views : 0,
      },
      userVote: null,
      timestamp: post.createdAt,
      imageUrls: imageUrlsFinal,
      gifUrl: prox(post.gifUrl) || null,
      // Prefer durable path-mode if server provided bucket+path, else proxy the URL
      videoUrl: (post?.videoBucket && post?.videoPath)
        ? `/api/video?path=${encodeURIComponent(String(post.videoPath))}&bucket=${encodeURIComponent(String(post.videoBucket))}`
        : (post.videoUrl ? proxVideo(post.videoUrl) : null),
      thumbnailUrl: prox(post.thumbnailUrl) || null,
      // Cloudflare Stream
      cfUid: post.cfUid || post.cf_uid || null,
      cfPlaybackUrlHls: post.cfPlaybackUrlHls || post.cf_playback_url_hls || null,
      captionVttUrl: post.captionVttUrl || post.caption_vtt_url || null,
      storyboardVttUrl: post.storyboardVttUrl || post.storyboard_vtt_url || null,
      duration_s: post.duration_s || post.durationSeconds || post.duration || null,
      codecs: post.codecs || null,
      audioUrl: post.audioUrl || null,
      audioTranscription: post.audioTranscription || null,
      transcriptionStatus: post.transcriptionStatus || null,
      emoji: post.emoji || '🎯',
      // Apply server gradient if provided; otherwise fall back to deterministic scheme
      gradientFromColor: (post as any).gradientFromColor || fallbackScheme?.gradientFromColor || null,
      gradientToColor:   (post as any).gradientToColor   || fallbackScheme?.gradientToColor   || null,
      gradientViaColor:  (post as any).gradientViaColor  || fallbackScheme?.gradientViaColor  || null,
      gradientDirection: (post as any).gradientDirection || 'to-br',
      // transient job state (client-side only)
      ...(post.status ? ({ status: post.status } as any) : {}),
      ...(post.trimJobId ? ({ trimJobId: post.trimJobId } as any) : {}),
    } as DashboardCommitmentCardProps;
    try {
      console.debug('[DashboardClient] map post', post.id, {
        cfUid: mapped.cfUid,
        cfPlaybackUrlHls: mapped.cfPlaybackUrlHls,
        videoUrl: mapped.videoUrl,
      });
      if (!mapped.videoUrl && !mapped.cfUid && !mapped.cfPlaybackUrlHls && (post?.videoUrl || post?.cfUid || post?.cfPlaybackUrlHls)) {
        console.warn('[DashboardClient] server returned media fields but mapping resolved to empty', {
          rawVideoUrl: post?.videoUrl,
          rawCfUid: post?.cfUid,
          rawCfHls: post?.cfPlaybackUrlHls,
        });
      }
    } catch {}
    return mapped;
  };

  // Basic handlers to satisfy props and enable minimal UX
  const handleCreateCommitment = useCallback((tempPost: any) => {
    try {
      if (!tempPost) return;
      const id = tempPost.id || tempPost.tempId || `temp-${Date.now()}`;
      // If it's already shaped like a card, use it but ensure safe defaults
      const ensureStats = (s: any) => ({
        likes: typeof s?.likes === 'number' ? s.likes : 0,
        comments: typeof s?.comments === 'number' ? s.comments : 0,
        reposts: typeof s?.reposts === 'number' ? s.reposts : 0,
        views: typeof s?.views === 'number' ? s.views : 0,
      });
      const optimistic: DashboardCommitmentCardProps = {
        id,
        content: tempPost.content || '',
        carrotText: tempPost.carrotText || '',
        stickText: tempPost.stickText || '',
        author: {
          name: '',
          username: (tempPost.author && tempPost.author.username) || (session?.user as any)?.username || 'user',
          avatar: (tempPost.author && tempPost.author.avatar)
            || (session?.user as any)?.profilePhoto
            || (session?.user as any)?.image
            || '/avatar-placeholder.svg',
          flag: (tempPost.author && (tempPost.author as any).flag)
            || (tempPost as any)?.homeCountry
            || (tempPost.User && (tempPost.User as any).country)
            || null,
          id: (tempPost.author && tempPost.author.id) || (session?.user as any)?.id || 'u_local',
        },
        homeCountry: tempPost.homeCountry || (tempPost.User?.country) || null,
        location: { zip: '10001', city: 'New York', state: 'NY' },
        stats: ensureStats(tempPost.stats),
        userVote: null,
        timestamp: tempPost.createdAt || new Date().toISOString(),
        imageUrls: Array.isArray(tempPost.imageUrls) ? tempPost.imageUrls : [],
        gifUrl: tempPost.gifUrl || null,
        videoUrl: tempPost.videoUrl || null,
        thumbnailUrl: tempPost.thumbnailUrl || null,
        audioUrl: tempPost.audioUrl || null,
        audioTranscription: tempPost.audioTranscription || null,
        transcriptionStatus: tempPost.transcriptionStatus || null,
        emoji: tempPost.emoji || '🎯',
        // Preserve gradients picked in the composer
        gradientFromColor: tempPost.gradientFromColor || (tempPost as any)?.gradient?.from || null,
        gradientToColor: tempPost.gradientToColor || (tempPost as any)?.gradient?.to || null,
        gradientViaColor: tempPost.gradientViaColor || (tempPost as any)?.gradient?.via || null,
        gradientDirection: tempPost.gradientDirection || (tempPost as any)?.gradient?.direction || 'to-br',
        // CF fields (if composer provided)
        cfUid: tempPost.cfUid || null,
        cfPlaybackUrlHls: tempPost.cfPlaybackUrlHls || null,
        captionVttUrl: tempPost.captionVttUrl || null,
        storyboardVttUrl: tempPost.storyboardVttUrl || null,
        duration_s: tempPost.duration_s || tempPost.duration || null,
        codecs: tempPost.codecs || null,
      } as any;

      setCommitments(prev => {
        if (prev.find(p => p.id === id)) return prev;
        const viewerId = (session?.user as { id?: string } | undefined)?.id
        const by = String(tempPost?.repostedBy || '').trim()
        if (viewerId && optimistic.author?.id === viewerId && (!by || by === viewerId)) return prev
        return [optimistic, ...prev];
      });
    } catch {}
  }, [session, setCommitments]);

  const handlePost = handleCreateCommitment;

  const handleVote = useCallback((id: string, vote: VoteType) => {
    try {
      setCommitments(prev => prev.map(p => p.id === id ? ({
        ...p,
        userVote: vote,
        stats: {
          ...p.stats,
          likes: typeof p.stats?.likes === 'number' ? Math.max(0, p.stats.likes + (vote ? 1 : -1)) : 0,
        }
      }) : p));
    } catch {}
  }, [setCommitments]);

  // Map dashboard commitments to FeedMediaManager PostAsset and seed preloading
  // This runs whenever the feed data changes and ensures the offscreen preloader is active
  useEffect(() => {
    (async () => {
      try {
        const mod = await import('../../../components/video/FeedMediaManager');
        const FMM = (mod as any).default || mod;
        if (!FMM) return;

        const posts = (commitments || []).map((c, idx) => {
          const hasVideo = !!(c as any).videoUrl;
          const hasAudio = !!(c as any).audioUrl && !hasVideo;
          const hasImages = Array.isArray((c as any).imageUrls) && (c as any).imageUrls.length > 0;
          const type: 'video' | 'audio' | 'image' | 'text' = hasVideo ? 'video' : (hasAudio ? 'audio' : (hasImages ? 'image' : 'text'));
          const thumbnailUrl = (c as any).thumbnailUrl || (hasImages ? (c as any).imageUrls[0] : null) || undefined;
          const videoUrl = (c as any).videoUrl || undefined;
          return {
            id: String((c as any).id),
            type,
            thumbnailUrl,
            videoUrl,
            feedIndex: idx,
          } as import('../../../components/video/FeedMediaManager').PostAsset;
        });

        FMM.inst.setPosts(posts);
      } catch {}
    })();
  }, [commitments]);

  const handleDeletePost = useCallback(async (id: string) => {
    try {
      setCommitments(prev => prev.filter(p => p.id !== id));
      // Fire-and-forget server delete
      fetch(`/api/posts/${id}`, { method: 'DELETE' }).catch(() => {});
    } catch {}
  }, [setCommitments]);

  const handleBlockPost = useCallback((id: string) => {
    try {
      // Local hide for now; future: add user blocks/categories
      setCommitments(prev => prev.filter(p => p.id !== id));
    } catch {}
  }, [setCommitments]);

  // Keep a ref to the latest commitments for polling
  const commitmentsRef = useRef(commitments);
  useEffect(() => { commitmentsRef.current = commitments; }, [commitments]);

  // Dev-only: provide a mock post so visuals can be tested without a DB
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_USE_MOCK_FEED !== '1') return;
    if (commitments && commitments.length > 0) return;
    const avatar = (session?.user as any)?.profilePhoto || (session?.user as any)?.image || '/avatar-placeholder.svg';
    const mock: DashboardCommitmentCardProps = {
      id: 'mock-1',
      content: 'Mock audio post to verify AudioHero visuals (arc/liquid/radial).',
      carrotText: 'Carrot',
      stickText: 'Stick',
      author: {
        name: '',
        username: (session?.user as any)?.username || 'demo',
        avatar,
        flag: null,
        id: (session?.user as any)?.id || 'u_mock',
      },
      homeCountry: null,
      location: { zip: '10001', city: 'New York', state: 'NY' },
      stats: { likes: 12, comments: 3, reposts: 1, views: 180 },
      userVote: null,
      timestamp: new Date().toISOString(),
      imageUrls: [],
      gifUrl: null,
      videoUrl: null,
      thumbnailUrl: null,
      // Route external audio through local proxy to avoid CORS in dev
      audioUrl: `/api/proxy-audio?url=${encodeURIComponent('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3')}`,
      audioTranscription: null,
      transcriptionStatus: null,
      emoji: '🎯',
      gradientFromColor: '#ff8a00',
      gradientToColor: '#8e2de2',
      gradientViaColor: '#ff5f6d',
      gradientDirection: 'to-r',
    } as any;
    setCommitments([mock]);
  }, [commitments, session]);

  // Sync server-rendered playback prefs to localStorage ASAP to avoid client flicker
  useEffect(() => {
    if (!serverPrefs) return;
    try {
      if (typeof serverPrefs.reducedMotion === 'boolean') {
        if (serverPrefs.reducedMotion) localStorage.setItem('carrot_reduced_motion', '1');
        else localStorage.removeItem('carrot_reduced_motion');
      }
      if (typeof serverPrefs.captionsDefault === 'boolean') {
        localStorage.setItem('carrot_captions_default', serverPrefs.captionsDefault ? 'on' : 'off');
      }
      if (typeof serverPrefs.autoplay === 'boolean') {
        localStorage.setItem('carrot_autoplay_default', serverPrefs.autoplay ? 'on' : 'off');
      }
    } catch {}
  }, [serverPrefs]);

  // Deterministic Active/Warm selection for feed tiles
  // Default: enabled unless explicitly disabled via NEXT_PUBLIC_FEED_HLS=0
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_FEED_HLS === '0') return;
    const root = document;
    // Hysteresis thresholds to avoid flip-flop
    const ENTER_ACTIVE = 0.65;
    const EXIT_ACTIVE = 0.50;
    const ENTER_WARM = 0.55;
    const EXIT_WARM = 0.35;
    const EXIT_IDLE = 0.25;
    const DOWNGRADE_DEBOUNCE_MS = 350; // delay before demoting to Idle
    const pending = new Map<Element, number>();
    const demoteTimers = new Map<Element, number>();
    // Debug ring buffer for tests/e2e assertions
    const debug = {
      push(evt: any) {
        try {
          const w: any = window as any;
          if (!w.__carrot_feed_log) w.__carrot_feed_log = [];
          const buf = w.__carrot_feed_log as any[];
          const entry = { ts: Date.now(), ...evt };
          buf.push(entry);
          if (buf.length > 500) buf.shift();
          w.dispatchEvent(new CustomEvent('carrot-feed-log', { detail: entry }));
        } catch {}
      }
    };
    // Fast-scroll guard: if scrolling faster than ~1.5 screens/s, skip warming
    const fastScrollRef = { v: false } as { v: boolean };
    let lastY = window.scrollY, lastT = performance.now();
    const onScroll = () => {
      const now = performance.now();
      const dy = Math.abs(window.scrollY - lastY);
      const dt = Math.max(1, now - lastT);
      const screensPerSec = (dy / Math.max(1, window.innerHeight)) / (dt / 1000);
      fastScrollRef.v = screensPerSec > 1.5;
      lastY = window.scrollY; lastT = now;
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    // Lazily load FeedMediaManager only if/when needed
    let FMM: any = null;
    let isFastScroll: any = null;
    const ensureFMM = async () => {
      if (FMM) return FMM;
      const mod = await import('../../../components/video/FeedMediaManager');
      FMM = (mod as any).default || mod;
      isFastScroll = mod.isFastScroll;
      return FMM;
    };

    // Track all tiles deterministically by DOM order
    let observed: HTMLElement[] = [];
    const refreshObserved = () => {
      observed = Array.from(root.querySelectorAll('[data-commitment-id]')) as HTMLElement[];
    };
    refreshObserved();

    // IO only updates visibility ratios; we pick active/warm deterministically
    const ratios = new Map<HTMLElement, number>();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const el = e.target as HTMLElement;
        ratios.set(el, e.intersectionRatio);
        const prev = pending.get(el); if (prev) clearTimeout(prev);
      }
      const t = window.setTimeout(async () => {
        await ensureFMM(); if (!FMM) return;
        // Compute Active: element whose center is nearest viewport center among visible ones
        const centerY = window.innerHeight / 2;
        const candidates = observed.filter(el => (ratios.get(el) || 0) > 0);
        let activeEl: HTMLElement | null = null;
        let bestDist = Number.POSITIVE_INFINITY;
        for (const el of candidates) {
          const r = el.getBoundingClientRect();
          const elCenter = r.top + r.height / 2;
          const d = Math.abs(elCenter - centerY);
          if (d < bestDist) { bestDist = d; activeEl = el; }
        }
        if (activeEl) {
          const handle = FMM.inst.getHandleByElement(activeEl);
          if (handle) {
            FMM.inst.setActive(handle);
            try {
              const idx = observed.indexOf(activeEl);
              if (idx >= 0) {
                FMM.inst.setViewportIndex(idx);
              }
            } catch {}
            try {
              const idx = observed.indexOf(activeEl);
              const id = activeEl.getAttribute('data-commitment-id');
              debug.push({ type: 'active', index: idx, id });
            } catch {}
          }
          // Choose Warm deterministically: next index by scroll direction
          if (!fastScrollRef.v) {
            const idx = observed.indexOf(activeEl);
            const dir = (window.scrollY - lastY) >= 0 ? 1 : -1; // +1 when scrolling down
            const warmIdx = Math.max(0, Math.min(observed.length - 1, idx + dir));
            if (warmIdx !== idx) {
              const warmEl = observed[warmIdx];
              const warmRatio = ratios.get(warmEl) || 0;
              // Only warm when it’s at least somewhat in/near view to avoid waste
              if (warmEl && warmRatio >= ENTER_WARM) {
                const handleW = FMM.inst.getHandleByElement(warmEl);
                if (handleW) {
                  // Fast-scroll guard: don't warm if user is flinging
                  if (!isFastScroll()) {
                    FMM.inst.setWarm(handleW);
                  } else {
                    console.debug('[DashboardClient] Skipped preload due to fast scroll');
                  }
                }
              }
            }
          }
          // Demote far elements deterministically
          for (const el of observed) {
            if (el === activeEl) continue;
            const ratio = ratios.get(el) || 0;
            if (ratio <= EXIT_IDLE) {
              const h = FMM.inst.getHandleByElement(el);
              if (h) {
                const prev = demoteTimers.get(el); if (prev) clearTimeout(prev);
                const t2 = window.setTimeout(() => {
                  const nowRatio = ratios.get(el) || 0;
                  if (nowRatio <= EXIT_IDLE) {
                    FMM.inst.setIdle(h);
                    try {
                      const idx = observed.indexOf(el);
                      const id = el.getAttribute('data-commitment-id');
                      debug.push({ type: 'idle', index: idx, id });
                    } catch {}
                  }
                  demoteTimers.delete(el);
                }, DOWNGRADE_DEBOUNCE_MS);
                demoteTimers.set(el, t2);
              }
            }
          }
        }
      }, 180);
      pending.set(entries[0]?.target as HTMLElement, t);
    }, { threshold: [0, EXIT_IDLE, EXIT_WARM, EXIT_ACTIVE, ENTER_WARM, ENTER_ACTIVE, 1] as any });

    const ENTER_IDLE_SAFE = 0.10; // small presence in viewport vicinity (kept for safety)

    const attach = () => {
      refreshObserved();
      observed.forEach((el) => io.observe(el));
    };
    const detach = () => io.disconnect();

    const t = setTimeout(attach, 0);
    window.addEventListener('resize', attach);
    return () => { clearTimeout(t); window.removeEventListener('resize', attach); window.removeEventListener('scroll', onScroll); detach(); demoteTimers.forEach(id => clearTimeout(id)); demoteTimers.clear(); };
  }, []);

  // Poll background trim jobs and update posts when they complete (with conservative backoff)
  useEffect(() => {
    let cancelled = false;
    let delayMs = 30000; // Start with 30 seconds instead of 3

    const tick = async () => {
      if (cancelled) return;
      const current = commitmentsRef.current as any[];
      const jobs = current.filter((c) => c && (c as any).trimJobId);
      if (jobs.length === 0) {
        // Back off when there are no jobs (max 2 minutes)
        delayMs = Math.min(delayMs + 10000, 120000);
      } else {
        delayMs = 30000; // active jobs: poll every 30 seconds (was 3s!)
        for (const c of jobs) {
          const jobId = (c as any).trimJobId as string;
          if (!jobId) continue;
          try {
            const res = await fetch(`/api/ingest/${jobId}`);
            if (!res.ok) continue;
            const data = await res.json().catch(() => null);
            const job = data?.job;
            if (!job) continue;
            // While processing/queued, update progress if available
            if (job.status === 'queued' || job.status === 'processing') {
              if (typeof job.progress === 'number') {
                setCommitments(prev => prev.map(p => p.id === c.id ? ({ ...(p as any), processingProgress: job.progress }) as any : p));
              }
            }
            if (job.status === 'completed') {
              setCommitments(prev => prev.map(p => {
                if (p.id !== c.id) return p;
                const next: any = { ...p };
                if (job.mediaUrl) next.videoUrl = job.mediaUrl;
                if (typeof job.cfUid !== 'undefined') next.cfUid = job.cfUid;
                if (typeof job.cfStatus !== 'undefined') next.cfStatus = job.cfStatus;
                next.status = undefined;
                next.trimJobId = undefined;
                next.processingProgress = undefined;
                return next;
              }));
              try { showSuccessToast('Trim complete. Your post has been updated.'); } catch {}
            } else if (job.status === 'failed') {
              setCommitments(prev => prev.map(p => p.id === c.id ? ({ ...(p as any), status: 'failed', processingProgress: undefined, lastError: job.error }) as any : p));
              try { showErrorToast(`Trim failed${job?.error ? `: ${String(job.error).slice(0,160)}` : ''}`); } catch {}
            }
          } catch {
            // ignore transient errors
          }
        }
      }
      if (!cancelled) setTimeout(tick, delayMs);
    };

    const starter = setTimeout(tick, delayMs);
    return () => { cancelled = true; clearTimeout(starter); };
  }, []);

  // Paint the last timeline before the network returns, the same way a reload of X does.
  useLayoutEffect(() => {
    const cached = readFeedCache();
    if (cached) setCommitments(unstacked(forHome(cached, (session?.user as { id?: string } | undefined)?.id)));
  }, []);

  // On mount, fetch latest posts and reconcile to avoid any SSR/env mismatch issues.
  // One shared request: a second mount while it is in flight reuses the same result.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (process.env.NEXT_PUBLIC_USE_MOCK_FEED === '1') return;
      try {
        const params = new URLSearchParams(window.location.search);
        const openId = params.get('modal') === '1' ? params.get('post') : null;
        if (openId) {
          await fetch(`/api/posts/${encodeURIComponent(openId)}`).catch(() => null);
        }
        const posts = await fetchFeedOnce();
        if (cancelled) return;
        if (!posts) {
          setFeedNote('failed');
          return;
        }
        const mapped = unstacked(forHome(posts.map(mapServerPostToCard).filter((post: any) => post && post.author && post.author.username), (session?.user as { id?: string } | undefined)?.id));
        if (cancelled) return;
        setCommitments(mapped);
        setFreshPosts([]);
        setFeedNote('');
        writeFeedCache(mapped);
      } catch (e) {
        if (!cancelled) setFeedNote('failed');
        console.warn('Feed load error', e);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const mapRef = useRef(mapServerPostToCard);
  mapRef.current = mapServerPostToCard;

  useEffect(() => {
    let stopped = false;
    const look = async () => {
      if (document.visibilityState === 'hidden') return;
      const current = commitmentsRef.current;
      const newest = current.reduce<number>((max, post) => {
        const time = new Date(post.timestamp || 0).getTime();
        return Number.isFinite(time) && time > max ? time : max;
      }, 0);
      if (!newest) return;
      try {
        const res = await fetch(`/api/posts?after=${encodeURIComponent(new Date(newest).toISOString())}`, { cache: 'no-store' });
        if (!res.ok || stopped) return;
        const rows = await res.json();
        if (!Array.isArray(rows) || stopped) return;
        const known = new Set(current.map((post) => post.id));
        const mapped = forHome(rows
          .map((row) => mapRef.current(row))
          .filter((post) => post && post.author && post.author.username && !known.has(post.id) && hasQuotePhoto(post)), (session?.user as { id?: string } | undefined)?.id);
        if (!stopped) setFreshPosts(mapped);
      } catch {}
    };
    const first = window.setTimeout(look, 4000);
    const timer = window.setInterval(look, 40000);
    const onVisible = () => { if (document.visibilityState === 'visible') look(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      window.clearTimeout(first);
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const revealFresh = () => {
    if (freshPosts.length === 0) return;
    setCommitments((prev) => {
      const ids = new Set(freshPosts.map((post) => post.id));
      const next = unstacked([...freshPosts, ...prev.filter((post) => !ids.has(post.id))]);
      writeFeedCache(next);
      return next;
    });
    setFreshPosts([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Hydration & spinner diagnostics
  useEffect(() => {
    try { console.log('[Dashboard] Hydrated'); } catch {}
    const ENABLE = process.env.NEXT_PUBLIC_ENABLE_PERF_LOG === '1' || process.env.NODE_ENV !== 'production';
    if (!ENABLE) return; // enable in dev or when explicitly flagged in prod
    const origFetch = window.fetch.bind(window);
    const inflight = new Map<number, { url: string; start: number; timeout: number }>();
    let seq = 1;
    (window as any).fetch = async (...args: any[]) => {
      const id = seq++;
      const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
      const start = Date.now();
      const timeout = window.setTimeout(() => {
        try { console.warn('[Fetch>30s]', { url, id, startedMsAgo: Date.now() - start }); } catch {}
      }, 30000);
      inflight.set(id, { url, start, timeout });
      try {
        // Force keepalive:false by default unless explicitly passed
        if (typeof args[1] === 'object') {
          args[1] = { keepalive: false, ...(args[1] || {}) };
        } else {
          args[1] = { keepalive: false };
        }
        const res = await (origFetch as any)(...args);
        return res;
      } finally {
        const entry = inflight.get(id);
        if (entry) { clearTimeout(entry.timeout); inflight.delete(id); }
      }
    };
    // beforeunload: dump pending requests (dev/perf mode only)
    const onBeforeUnload = () => {
      try {
        if (inflight.size > 0) {
          console.warn('[beforeunload] pending fetches:', Array.from(inflight.values()).map(v => ({ url: v.url, ageMs: Date.now() - v.start })));
        }
      } catch {}
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    // Page-load guard: after 5s, report any inflight fetches
    const fiveSec = window.setTimeout(() => {
      try {
        if (inflight.size > 0) {
          console.warn('[PageLoadGuard>5s] pending fetches:', Array.from(inflight.values()).map(v => ({ url: v.url, ageMs: Date.now() - v.start })));
        }
      } catch {}
    }, 5000);
    // LCP and long-task observers
    try {
      const observePerf = () => {
        try {
          // LCP
          const po = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            for (const e of entries) {
              if ((e as any).value) console.log('[Perf] LCP', (e as any).value, 'ms');
            }
          });
          po.observe({ type: 'largest-contentful-paint', buffered: true } as any);
          // Long tasks
          const longPo = new PerformanceObserver((list) => {
            for (const e of list.getEntries()) {
              if (e.duration > 50) console.warn('[Perf] LongTask', { duration: Math.round(e.duration), name: e.name || 'task' });
            }
          });
          longPo.observe({ type: 'longtask', buffered: true } as any);
        } catch {}
      };
      if ('PerformanceObserver' in window) observePerf();
    } catch {}
    return () => { (window as any).fetch = origFetch; window.removeEventListener('beforeunload', onBeforeUnload); inflight.forEach(e => clearTimeout(e.timeout)); inflight.clear(); };
  }, []);

  const handleUpdateCommitment = useCallback((tempId: string, updatedPost: any) => {
    // Update post with real ID after database save
    console.log('🔄 DashboardClient updating post:', tempId, '→', updatedPost.id || tempId);
    console.log('📊 Status update details:', {
      tempId,
      uploadStatus: updatedPost.uploadStatus,
      transcriptionStatus: updatedPost.transcriptionStatus,
      videoUrl: updatedPost.videoUrl?.substring(0, 50) + '...',
      audioUrl: updatedPost.audioUrl?.substring(0, 50) + '...'
    });
    
    // Pre-map server post to our card shape for consistent media URL proxying
    const mappedFromServer = mapServerPostToCard(updatedPost);

    setCommitments(prev => 
      prev.map(commitment => {
        if (commitment.id === tempId) {
          // Preserve media data from optimistic UI if database post doesn't have it
          // IMPORTANT: Prioritize new Firebase URLs over old blob URLs
          const preservedMediaData = {
            audioUrl: updatedPost.audioUrl || commitment.audioUrl,
            videoUrl: updatedPost.videoUrl || commitment.videoUrl,
            audioTranscription: updatedPost.audioTranscription || commitment.audioTranscription,
            transcriptionStatus: updatedPost.transcriptionStatus || commitment.transcriptionStatus,
            uploadStatus: updatedPost.uploadStatus !== undefined ? updatedPost.uploadStatus : commitment.uploadStatus,
            uploadProgress: updatedPost.uploadProgress !== undefined ? updatedPost.uploadProgress : commitment.uploadProgress,
            // Preserve images from optimistic state if server omitted them
            imageUrls: (mappedFromServer.imageUrls && mappedFromServer.imageUrls.length > 0)
              ? mappedFromServer.imageUrls
              : (commitment.imageUrls || []),
            // Preserve gradient fields from optimistic UI if server omitted them
            gradientFromColor: mappedFromServer.gradientFromColor || (commitment as any).gradientFromColor || null,
            gradientToColor: mappedFromServer.gradientToColor || (commitment as any).gradientToColor || null,
            gradientViaColor: mappedFromServer.gradientViaColor || (commitment as any).gradientViaColor || null,
            gradientDirection: mappedFromServer.gradientDirection || (commitment as any).gradientDirection || 'to-br',
          };
          
          console.log('🎬 Media URL update details:', {
            tempId,
            updatedVideoUrl: updatedPost.videoUrl,
            commitmentVideoUrl: commitment.videoUrl,
            finalVideoUrl: preservedMediaData.videoUrl,
            uploadStatus: preservedMediaData.uploadStatus,
            transcriptionStatus: preservedMediaData.transcriptionStatus,
            isFirebaseVideoUrl: updatedPost.videoUrl?.includes('firebasestorage.googleapis.com'),
            isBlobVideoUrl: commitment.videoUrl?.includes('blob:')
          });
          
          // CRITICAL FIX: Merge carefully to prevent unnecessary re-renders
          const merged: any = { ...commitment, ...mappedFromServer, ...preservedMediaData };
          
          // Preserve homeCountry from optimistic if server doesn't provide it
          if (!mappedFromServer.homeCountry && (commitment as any).homeCountry) {
            merged.homeCountry = (commitment as any).homeCountry;
          }
          
          // Preserve gradient fields from optimistic if server omitted them
          const gf = ['gradientFromColor','gradientToColor','gradientViaColor','gradientDirection'] as const;
          for (const key of gf) {
            if (!(key in mappedFromServer) || (mappedFromServer as any)[key] == null) {
              if ((commitment as any)[key] != null) merged[key] = (commitment as any)[key];
            }
          }
          
          // CRITICAL: Check if videoUrl actually changed - if not, keep the exact same reference
          if (merged.videoUrl === commitment.videoUrl) {
            console.log('🎬 VideoUrl unchanged, preserving reference to prevent remount', { postId: tempId });
            merged.videoUrl = commitment.videoUrl; // Use exact same reference
          } else if (merged.videoUrl) {
            console.log('🎬 VideoUrl CHANGED, video will remount', { 
              tempId,
              oldUrl: commitment.videoUrl?.substring(0, 50),
              newUrl: merged.videoUrl?.substring(0, 50)
            });
          }
          
          return merged as any;
        }
        return commitment;
      })
    );
  }, [setCommitments, showSuccessToast]);

  // ... (rest of the code remains the same)

  const updatePost = useCallback((tempId: string, updatedPost: any) => {
    // Update post with real ID after database save
    console.log('🔄 DashboardClient updating post:', tempId, '→', updatedPost.id);
    setCommitments(prev => 
      prev.map(commitment => {
        if (commitment.id === tempId) {
          return { ...commitment, ...updatedPost };
        }
        return commitment;
      })
    );
  }, [setCommitments]);

  const updatePostAudioUrl = useCallback((postId: string, newAudioUrl: string) => {
    console.log('🎵 DashboardClient updating audio URL for post:', postId, '→', newAudioUrl);
    setCommitments(prev => 
      prev.map(commitment => {
        if (commitment.id === postId) {
          console.log('🎵 Updating audio URL from blob to Firebase:', {
            from: commitment.audioUrl,
            to: newAudioUrl
          });
          return { ...commitment, audioUrl: newAudioUrl };
        }
        return commitment;
      })
    );
  }, [setCommitments]);

  const handleToggleBookmark = (id: string) => {
    console.log(`Toggled bookmark on commitment ${id}`);
    // TODO: Implement bookmark logic
  };

  return (
    <VideoProvider>
      <div className="dashboard-feed-root">
        {/* Fixed Composer Container */}
        <div className="sticky top-0 z-20 bg-[#F6F3EE]">
          <div className="pb-3">
            {isModalComposer ? (
              <ComposerTrigger onOpenModal={() => setIsModalOpen(true)} />
            ) : (
              <ComposerDynamic onPost={handleCreateCommitment} onPostUpdate={handleUpdateCommitment} />
            )}
          </div>
        </div>
        {freshPosts.length > 0 && (
          <button
            type="button"
            onClick={revealFresh}
            className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-full bg-[#1C1917] px-4 py-2 text-sm font-semibold text-white shadow-lg"
          >
            {freshPosts.length === 1 ? '1 new post' : `${freshPosts.length} new posts`}
          </button>
        )}
        
        {/* Scrollable Feed Content */}
        <div className="px-4">
          {commitments.length === 0 && feedNote === 'loading' && (
            <p className="py-8 text-sm text-[#60646C]">Loading your feed…</p>
          )}
          {commitments.length === 0 && feedNote === 'failed' && (
            <div className="py-8">
              <p className="text-sm text-[#60646C]">The feed did not load.</p>
              <button
                type="button"
                onClick={() => { setFeedNote('loading'); window.location.reload(); }}
                className="mt-3 rounded-full bg-[#0B0B0F] px-4 py-2 text-sm font-semibold text-white"
              >
                Try again
              </button>
            </div>
          )}
          <div className="space-y-4">
            {commitments.filter(commitment => commitment && commitment.author && commitment.author.username).slice(0, visiblePostCount).map((commitment, index) => {
              const liveShow = liveShows[feedLiveSlot(index)]
              return (
              <Fragment key={commitment.id}>
              <DwellMark postId={commitment.id}>
              <div data-post-index={index}>
                <CommitmentCard
                  {...commitment}
                  currentUserId={(session?.user as any)?.id}
                  onVote={(vote) => handleVote(commitment.id, vote as VoteType)}
                  onDelete={handleDeletePost}
                  onBlock={handleBlockPost}
                  autoPlay={index === 0}
                  feedIndex={index}
                />
              </div>
              </DwellMark>
              {(index + 1) % 5 === 0 && <FeedRectangle />}
              {liveShow && <LiveFeedCard item={liveShow} />}
              </Fragment>
              )
            })}
          </div>
        </div>
      </div>
      
      {isModalComposer && (
        <ComposerModalDynamic
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onPost={handlePost}
          onPostUpdate={handleUpdateCommitment}
        />
      )}

      {/* Toast notifications for job completion/failure */}
      {showToast && (
        <Toast
          message={toastMessage}
          type={toastType}
          isVisible={showToast}
          onClose={() => setShowToast(false)}
        />)
      }
    </VideoProvider>
  );
}
