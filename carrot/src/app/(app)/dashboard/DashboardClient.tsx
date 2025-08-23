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

export interface DashboardCommitmentCardProps extends Omit<CommitmentCardProps, 'onVote' | 'onToggleBookmark'> {
  // Add any additional props specific to Dashboard if needed
}

interface DashboardClientProps {
  initialCommitments: DashboardCommitmentCardProps[];
  isModalComposer?: boolean;
}



import { useSyncFirebaseAuth } from '../../../lib/useSyncFirebaseAuth';

export default function DashboardClient({ initialCommitments, isModalComposer = false }: DashboardClientProps) {
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
    const imageUrls = (() => {
      if (!post?.imageUrls) return [];
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
    })();
    const mapped = {
      id: post.id,
      content: post.content || '',
      carrotText: post.carrotText || '',
      stickText: post.stickText || '',
      author: {
        name: '',
        username: post.User?.username || 'daniel',
        avatar: post.User?.profilePhoto || post.User?.image || 'https://firebasestorage.googleapis.com/v0/b/involuted-river-466315-p0.firebasestorage.app/o/users%2Fcmdm0m8pl00004sbcjr0i6vjg%2Fstaged%2Fe137a64b-9b76-4127-a4c0-5fb2cd4c3176%2F9e257b08-4682-4ab1-839a-5ab2298e3084.png?alt=media&token=a06d95fc-1656-42af-a36f-b9a3349d4239',
        flag: '🇺🇸',
        id: post.userId,
      },
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
              // Preserve CF identifiers/playback when server lacks them
              if (!m.cfUid && existing.cfUid) merged.cfUid = existing.cfUid;
              if (!m.cfPlaybackUrlHls && existing.cfPlaybackUrlHls) merged.cfPlaybackUrlHls = existing.cfPlaybackUrlHls;
              if (!m.thumbnailUrl && existing.thumbnailUrl) merged.thumbnailUrl = existing.thumbnailUrl;
              // Preserve optimistic upload/transcription states
              merged.uploadStatus = existing.uploadStatus ?? m.uploadStatus ?? null;
              merged.transcriptionStatus = existing.transcriptionStatus ?? m.transcriptionStatus ?? null;
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
