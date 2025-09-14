'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import CommitmentCard, { CommitmentCardProps, VoteType } from './components/CommitmentCard';
import COLOR_SCHEMES from '../../../config/colorSchemes';
import CommitmentComposer from './components/CommitmentComposer';
import ComposerTrigger from '../../../components/ComposerTrigger';
import ComposerModal from '../../../components/ComposerModal';
import { useState as useModalState } from 'react';
import Toast from './components/Toast';
import FeedMediaManager from '../../../components/video/FeedMediaManager';

export interface DashboardCommitmentCardProps extends Omit<CommitmentCardProps, 'onVote' | 'onToggleBookmark'> {
  // Add any additional props specific to Dashboard if needed
}

interface DashboardClientProps {
  initialCommitments: DashboardCommitmentCardProps[];
  isModalComposer?: boolean;
  serverPrefs?: { reducedMotion?: boolean; captionsDefault?: boolean; autoplay?: boolean };
}



import { useSyncFirebaseAuth } from '../../../lib/useSyncFirebaseAuth';

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
    const avatarFromPath = proxPath(userObj.profilePhotoPath);
    const avatarFromUrl = userObj.profilePhoto ? prox(String(userObj.profilePhoto)) : (userObj.image ? prox(String(userObj.image)) : null);
    const sessionAvatar = (session?.user as any)?.profilePhoto || (session?.user as any)?.image || null;
    const finalAvatar = avatarFromPath || avatarFromUrl || (sessionAvatar ? prox(String(sessionAvatar)) : null) || '/avatar-placeholder.svg';

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
      // IMPORTANT: do NOT proxy video URLs through /api/img; use raw URL
      videoUrl: post.videoUrl || null,
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
  const handleCreateCommitment = (tempPost: any) => {
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
  };

  const handlePost = handleCreateCommitment;

  const handleVote = (id: string, vote: VoteType) => {
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
  };

  const handleDeletePost = async (id: string) => {
    try {
      setCommitments(prev => prev.filter(p => p.id !== id));
      // Fire-and-forget server delete
      fetch(`/api/posts/${id}`, { method: 'DELETE' }).catch(() => {});
    } catch {}
  };

  const handleBlockPost = (id: string) => {
    try {
      // Local hide for now; future: add user blocks/categories
      setCommitments(prev => prev.filter(p => p.id !== id));
    } catch {}
  };

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
        flag: undefined,
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

  // Feature-flagged viewport-driven Warm/Active state with hysteresis + debounce
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_FEED_HLS !== '1') return;
    const root = document;
    const ENTER_ACTIVE = 0.75, ENTER_WARM = 0.60, EXIT_IDLE = 0.40;
    const pending = new Map<Element, number>();

    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const el = e.target as HTMLElement;
        const id = el.getAttribute('data-commitment-id');
        if (!id) continue;
        // Debounce transitions to avoid chatter
        const prev = pending.get(el);
        if (prev) clearTimeout(prev);
        const t = window.setTimeout(() => {
          const ratio = e.intersectionRatio;
          if (ratio >= ENTER_ACTIVE) {
            const handle = FeedMediaManager.inst.getHandleByElement(el);
            if (handle) FeedMediaManager.inst.setActive(handle);
          } else if (ratio >= ENTER_WARM) {
            const handle = FeedMediaManager.inst.getHandleByElement(el);
            if (handle) FeedMediaManager.inst.setWarm(handle);
          } else if (ratio <= EXIT_IDLE) {
            const handle = FeedMediaManager.inst.getHandleByElement(el);
            if (handle) FeedMediaManager.inst.setIdle(handle);
          }
        }, 180);
        pending.set(el, t);
      }
    }, { threshold: [EXIT_IDLE, ENTER_WARM, ENTER_ACTIVE] });

    const attach = () => {
      root.querySelectorAll('[data-commitment-id]')?.forEach((el) => io.observe(el));
    };
    const detach = () => io.disconnect();

    const t = setTimeout(attach, 0);
    window.addEventListener('resize', attach);
    return () => { clearTimeout(t); window.removeEventListener('resize', attach); detach(); };
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
        const res = await fetch('/api/posts', { cache: 'no-store' });
        if (!res.ok) return;
        const posts = await res.json();
        const mapped = posts.map(mapServerPostToCard);
        if (cancelled) return;
        setCommitments((prev) => {
          const byId = new Map(prev.map((p) => [p.id, p]));
          for (const m of mapped) {
            const existing = byId.get(m.id) as any;
            if (!existing) {
              byId.set(m.id, m);
            } else {
              // Merge while preserving existing non-null CF fields if server has null/undefined
              const merged: any = {
                ...existing,
                ...m,
              };
              // Preserve avatar from server-side rendering if it exists
              if (existing.author?.avatar && existing.author.avatar !== '/avatar-placeholder.svg') {
                merged.author = { ...m.author, avatar: existing.author.avatar };
              }
              // Preserve CF identifiers/playback when server lacks them
              if (!m.cfUid && existing.cfUid) merged.cfUid = existing.cfUid;
              if (!m.cfPlaybackUrlHls && existing.cfPlaybackUrlHls) merged.cfPlaybackUrlHls = existing.cfPlaybackUrlHls;
              if (!m.thumbnailUrl && existing.thumbnailUrl) merged.thumbnailUrl = existing.thumbnailUrl;
              // Preserve optimistic upload states but allow transcription status updates
              merged.uploadStatus = existing.uploadStatus ?? m.uploadStatus ?? null;
              merged.transcriptionStatus = m.transcriptionStatus ?? existing.transcriptionStatus ?? null;
              // Preserve homeCountry if server doesn't provide it
              if (!m.homeCountry && (existing as any).homeCountry) {
                (merged as any).homeCountry = (existing as any).homeCountry;
              }
              // Preserve gradient fields if server omits them
              const gf = ['gradientFromColor','gradientToColor','gradientViaColor','gradientDirection'] as const;
              for (const key of gf) {
                if (!(key in m) || (m as any)[key] == null) {
                  if ((existing as any)[key] != null) (merged as any)[key] = (existing as any)[key];
                }
              }
              byId.set(m.id, merged);
            }
          }
          // Return newest-first order by timestamp if available
          const arr = Array.from(byId.values());
          arr.sort((a: any, b: any) => new Date(b.timestamp as any).getTime() - new Date(a.timestamp as any).getTime());
          return arr as any;
        });
      } catch {}
    };
    load();
    return () => { cancelled = true; };
  }, []);

  // ... (rest of the code remains the same)

  const handleUpdateCommitment = (tempId: string, updatedPost: any) => {
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
          // Preserve homeCountry from optimistic if server omitted it
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
  };

  // ... (rest of the code remains the same)
  const updatePost = (tempId: string, updatedPost: any) => {
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
  };

  const updatePostAudioUrl = (postId: string, newAudioUrl: string) => {
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
  };

  const handleToggleBookmark = (id: string) => {
    console.log(`Toggled bookmark on commitment ${id}`);
    // TODO: Implement bookmark logic
  };

  return (
    <>
      <div className="dashboard-feed-root">
        <div className="px-4" style={{ paddingTop: '32px' }}>
          {isModalComposer ? (
            <ComposerTrigger onOpenModal={() => setIsModalOpen(true)} />
          ) : (
            <CommitmentComposer onPost={handleCreateCommitment} onPostUpdate={handleUpdateCommitment} />
          )}
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
        <ComposerModal
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
    </>
  );
}
