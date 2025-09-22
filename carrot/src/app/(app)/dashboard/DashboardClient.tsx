'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import CommitmentCard, { CommitmentCardProps, VoteType } from './components/CommitmentCard';
import COLOR_SCHEMES from '../../../config/colorSchemes';
import dynamic from 'next/dynamic';
import ComposerTrigger from '../../../components/ComposerTrigger';
import { useState as useModalState } from 'react';
import Toast from './components/Toast';
import { VideoProvider } from '../../../context/VideoContext';
import { FeedTabsContainer } from '../../../components/FeedTabsContainer';

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

export default function DashboardClient({ initialCommitments, isModalComposer = false, serverPrefs }: DashboardClientProps) {
  useSyncFirebaseAuth();
  const [commitments, setCommitments] = useState<DashboardCommitmentCardProps[]>(initialCommitments);
  const [isModalOpen, setIsModalOpen] = useModalState(false);
  const { data: session } = useSession();
  const router = useRouter();

  // Toast state (reuse same UX as ComposerModal)
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');
  const [showToast, setShowToast] = useState(false);
  const showSuccessToast = (msg: string) => { setToastMessage(msg); setToastType('success'); setShowToast(true); };
  const showErrorToast = (msg: string) => { setToastMessage(msg); setToastType('error'); setShowToast(true); };

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

  // Normalize server DB post -> CommitmentCardProps used by the feed
  const mapServerPostToCard = (post: any): DashboardCommitmentCardProps => {
    const prox = (u?: string | null) => (u ? `/api/img?url=${encodeURIComponent(u)}` : null);
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
    const avatarFromPath = proxPath(userObj.profilePhotoPath);
    const avatarFromUrlRaw = userObj.profilePhoto ? String(userObj.profilePhoto) : (userObj.image ? String(userObj.image) : null);
    const sessionAvatarRaw = (session?.user as any)?.profilePhoto || (session?.user as any)?.image || null;
    const finalAvatar = avatarFromPath || avatarFromUrlRaw || sessionAvatarRaw || '/avatar-placeholder.svg';

    // Username: prefer DB user.username, else session username/email local-part, else 'user'
    const sessionUsername = (session?.user as any)?.username || ((session?.user as any)?.email ? String((session?.user as any).email).split('@')[0] : null);
    const finalUsername = userObj?.username || sessionUsername || 'user';

    const mapped = {
      id: post.id,
      content: post.content || '',
      carrotText: post.carrotText || '',
      stickText: post.stickText || '',
      author: {
        name: '',
        username: finalUsername,
        avatar: finalAvatar,
        flag: userObj?.country || null,
        id: post.userId,
      },
      homeCountry: userObj?.country || null,
      location: { zip: '10001', city: 'New York', state: 'NY' },
      stats: {
        likes: Math.floor(Math.random() * 50),
        comments: Math.floor(Math.random() * 20),
        reposts: Math.floor(Math.random() * 10),
        views: Math.floor(Math.random() * 200) + 50,
      },
      userVote: null,
      timestamp: post.createdAt,
      imageUrls: imageUrlsFinal,
      gifUrl: prox(post.gifUrl) || null,
      // Prefer durable path-mode if server provided bucket+path, else fallback to URL
      videoUrl: (post?.videoBucket && post?.videoPath)
        ? `/api/video?path=${encodeURIComponent(String(post.videoPath))}&bucket=${encodeURIComponent(String(post.videoBucket))}`
        : (post.videoUrl || null),
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
        flag: 'US',
        id: (session?.user as any)?.id || 'u_mock',
      },
      homeCountry: 'US',
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

  // Poll background trim jobs and update posts when they complete (with simple backoff)
  useEffect(() => {
    let cancelled = false;
    let delayMs = 3000;

    const tick = async () => {
      if (cancelled) return;
      const current = commitmentsRef.current as any[];
      const jobs = current.filter((c) => c && (c as any).trimJobId);
      if (jobs.length === 0) {
        // Back off when there are no jobs (max 15s)
        delayMs = Math.min(delayMs + 2000, 15000);
      } else {
        delayMs = 3000; // active jobs: poll faster
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

  // On mount, fetch latest posts and reconcile to avoid any SSR/env mismatch issues
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (process.env.NEXT_PUBLIC_USE_MOCK_FEED === '1') return; // skip API in mock mode
      try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 15000);
        const res = await fetch('/api/posts', { cache: 'no-cache', signal: controller.signal, keepalive: false });
        clearTimeout(t);
        if (!res.ok) return;
        const posts = await res.json();
        const mapped = posts.map(mapServerPostToCard);
        if (cancelled) return;
        setCommitments(mapped);
      } catch (e) {
        console.warn('Feed load error', e);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

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
          
          // Merge mapped server fields to normalize proxies, then layer preserved fields
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
        <div className="px-4" style={{ paddingTop: '32px' }}>
          {isModalComposer ? (
            <ComposerTrigger onOpenModal={() => setIsModalOpen(true)} />
          ) : (
            <ComposerDynamic onPost={handleCreateCommitment} onPostUpdate={handleUpdateCommitment} />
          )}
          
          {/* Feed Tabs - positioned right under the composer */}
          <FeedTabsContainer />
          
          {/* Professional compact spacing for social media feed */}
          <div className="space-y-3 mt-6">
            {commitments.map((commitment) => (
              <CommitmentCard
                key={commitment.id}
                {...commitment}
                currentUserId={(session?.user as any)?.id}
                onVote={(vote) => handleVote(commitment.id, vote as VoteType)}
                onDelete={handleDeletePost}
                onBlock={handleBlockPost}
              />
            ))}
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
