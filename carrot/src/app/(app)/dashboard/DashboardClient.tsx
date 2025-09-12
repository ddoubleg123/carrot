'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import CommitmentCard, { CommitmentCardProps, VoteType } from './components/CommitmentCard';
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

  // Normalize server DB post -> CommitmentCardProps used by the feed
  const mapServerPostToCard = (post: any): DashboardCommitmentCardProps => {
    const prox = (u?: string | null) => (u ? `/api/img?url=${encodeURIComponent(u)}` : null);
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
    const mapped = {
      id: post.id,
      content: post.content || '',
      carrotText: post.carrotText || '',
      stickText: post.stickText || '',
      author: {
        name: '',
        username: post.User?.username || 'daniel',
        avatar: post.User?.profilePhoto || post.User?.image || (session?.user as any)?.profilePhoto || (session?.user as any)?.image || '/avatar-placeholder.svg',
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
      imageUrls,
      gifUrl: prox(post.gifUrl) || null,
      videoUrl: prox(post.videoUrl) || null,
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
      gradientFromColor: post.gradientFromColor || null,
      gradientToColor: post.gradientToColor || null,
      gradientViaColor: post.gradientViaColor || null,
      gradientDirection: post.gradientDirection || null,
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
    } catch {}
    return mapped;
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

  // Feature-flagged viewport-driven Warm/Active state (HLS feed rollout)
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_FEED_HLS !== '1') return;
    const root = document;
    const tiles = new Map<Element, string>();

    // Observe entries and select a single Active (>=0.75), one Warm (>=0.6), else Idle
    const io = new IntersectionObserver((entries) => {
      // Pick the most centered/highest ratio as candidate Active
      let best: { el: Element; ratio: number } | null = null;
      let warm: Element | null = null;
      for (const e of entries) {
        const id = (e.target as HTMLElement).getAttribute('data-commitment-id');
        if (!id) continue;
        tiles.set(e.target, id);
        const r = e.intersectionRatio;
        if (r >= 0.75 && (!best || r > best.ratio)) best = { el: e.target, ratio: r };
        else if (r >= 0.6) warm = e.target;
        else if (r <= 0.4) {
          // Demote quickly when off-screen
          const activeEl = (FeedMediaManager.inst.active as any)?.el as Element | undefined;
          if (activeEl && activeEl === e.target) FeedMediaManager.inst.setActive(undefined);
        }
      }
      if (best) {
        const handle = FeedMediaManager.inst.getHandleByElement(best.el);
        if (handle) FeedMediaManager.inst.setActive(handle);
      }
      if (warm) {
        const handle = FeedMediaManager.inst.getHandleByElement(warm);
        if (handle) FeedMediaManager.inst.setWarm(handle);
        // Prefetch next tile HLS playlist + first segment via SW (parse real URIs)
        (async () => {
          try {
            const master = (warm as HTMLElement).getAttribute('data-hls-master');
            const swc = (navigator as any)?.serviceWorker?.controller;
            if (!master || !swc) return;
            // Network guard: skip prefetch on data saver or very low downlink
            const conn: any = (navigator as any)?.connection || (navigator as any)?.mozConnection || (navigator as any)?.webkitConnection;
            if (conn) {
              const saveData = Boolean(conn.saveData);
              const downlink = typeof conn.downlink === 'number' ? conn.downlink : 10; // Mbps
              if (saveData || downlink < 1.5) return;
            }
            const masterUrl = new URL(master, location.href).toString();
            const res = await fetch(masterUrl, { cache: 'no-store' });
            if (!res.ok) return;
            const text = await res.text();
            const lines = text.split(/\r?\n/);
            // Try to find the lowest BANDWIDTH variant
            type Variant = { bandwidth: number; uri: string };
            const variants: Variant[] = [];
            for (let i = 0; i < lines.length - 1; i++) {
              const l = lines[i];
              if (l.startsWith('#EXT-X-STREAM-INF')) {
                const bwMatch = l.match(/BANDWIDTH=(\d+)/);
                const bw = bwMatch ? parseInt(bwMatch[1], 10) : 0;
                const uri = lines[i + 1];
                if (uri && !uri.startsWith('#')) variants.push({ bandwidth: bw, uri });
              }
            }
            // If no variants, this is already a media playlist
            let variantUrl = masterUrl;
            if (variants.length > 0) {
              variants.sort((a, b) => a.bandwidth - b.bandwidth);
              const chosen = variants[0];
              variantUrl = new URL(chosen.uri, masterUrl).toString();
            }
            // Fetch variant playlist and get first media segment
            const vres = await fetch(variantUrl, { cache: 'no-store' });
            if (!vres.ok) return;
            const vtxt = await vres.text();
            const vlines = vtxt.split(/\r?\n/);
            let firstSeg: string | null = null;
            for (let i = 0; i < vlines.length; i++) {
              const l = vlines[i];
              if (!l || l.startsWith('#')) continue;
              firstSeg = l.trim();
              break;
            }
            const segUrl = firstSeg ? new URL(firstSeg, variantUrl).toString() : null;
            const urls = [variantUrl].concat(segUrl ? [segUrl] : []);
            swc.postMessage({ type: 'PREFETCH', urls });
          } catch {}
        })();
      }
    }, { threshold: [0.4, 0.6, 0.75] });

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

  // Poll posts that have Cloudflare UID but are missing playback URL, so they update when webhook fills metadata
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_USE_MOCK_FEED === '1') return; // skip polling in mock mode
    let cancelled = false;
    let timer: any;

    const pollMissingCfPlayback = async () => {
      if (cancelled) return;
      const current = commitmentsRef.current as any[];
      const pending = current.filter(
        (c) => c && c.cfUid && !c.cfPlaybackUrlHls
      );
      if (pending.length === 0) {
        // nothing to do; back off to slower interval
        timer = setTimeout(pollMissingCfPlayback, 12000);
        return;
      }
      try {
        const res = await fetch('/api/posts');
        if (!res.ok) throw new Error('Failed to fetch posts');
        const posts = await res.json();
        // index by cfUid for quick lookup
        const byUid = new Map<string, any>();
        for (const p of posts) {
          const uid = p?.cfUid || p?.cf_uid;
          if (uid) byUid.set(uid, p);
        }
        setCommitments((prev) =>
          prev.map((c: any) => {
            if (!c?.cfUid || c?.cfPlaybackUrlHls) return c;
            const server = byUid.get(c.cfUid);
            if (!server) return c;
            // merge only relevant CF fields to avoid clobbering optimistic UI
            const next = { ...c } as any;
            if (server.cfPlaybackUrlHls || server.cf_playback_url_hls) {
              next.cfPlaybackUrlHls = server.cfPlaybackUrlHls || server.cf_playback_url_hls;
            }
            if (typeof server.cfStatus !== 'undefined' || typeof server.cf_status !== 'undefined') {
              next.cfStatus = server.cfStatus || server.cf_status || next.cfStatus || null;
            }
            if ((server.thumbnailUrl ?? server.thumbnail_url) && !next.thumbnailUrl) {
              next.thumbnailUrl = server.thumbnailUrl || server.thumbnail_url;
            }
            return next;
          })
        );
      } catch {
        // ignore transient failures
      } finally {
        if (!cancelled) timer = setTimeout(pollMissingCfPlayback, 5000);
      }
    };

    timer = setTimeout(pollMissingCfPlayback, 4000);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  const handlePost = async (serverPost: any) => {
    const mapped = mapServerPostToCard(serverPost);
    setCommitments(prev => [mapped, ...prev]);
  };

  const handleVote = (id: string, vote: VoteType) => {
    setCommitments(prevCommitments =>
      prevCommitments.map(commitment =>
        commitment.id === id
          ? {
              ...commitment,
              stats: {
                ...commitment.stats,
                likes: vote === 'carrot' ? (commitment.stats.likes || 0) + 1 : (commitment.stats.likes || 0),
              },
              userVote: vote,
            }
          : commitment
      )
    );
  };

  const handleDeletePost = (id: string) => {
    setCommitments(prev => prev.filter(commitment => commitment.id !== id));
  };

  const handleBlockPost = (id: string) => {
    setCommitments(prev => prev.filter(commitment => commitment.id !== id));
    console.log(`Post ${id} blocked`);
    // TODO: Store blocked post IDs in user preferences/database
  };

  const handleCreateCommitment = (post: any) => {
    // Accept full post object from CommitmentComposer (optimistic UI)
    setCommitments(prev => [post, ...prev]);
  };

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
            uploadProgress: updatedPost.uploadProgress !== undefined ? updatedPost.uploadProgress : commitment.uploadProgress
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
          
          return { ...commitment, ...updatedPost, ...preservedMediaData };
        }
        return commitment;
      })
    );
  };

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
