'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import { X, Camera, Mic, Image as ImageIcon, Smile, Zap, ChevronLeft, ChevronRight } from 'lucide-react';
import { uploadFilesToFirebase } from '../lib/uploadToFirebase';
import AudioRecorder from './AudioRecorder';
import AudioPlayer from './AudioPlayer';
import CFVideoPlayer from './CFVideoPlayer';
import Toast from '../app/(app)/dashboard/components/Toast';
import GifPicker from '../app/(app)/dashboard/components/GifPicker';
import ComposeHeader from './composer/ComposeHeader';
import ComposeTextArea from './composer/ComposeTextArea';
import FooterActions from './composer/FooterActions';
import AudioPreview from './composer/AudioPreview';
import ExternalIngestControls from './composer/ExternalIngestControls';
import AudioRecorderModal from './composer/AudioRecorderModal';
import ToastPortal from './composer/ToastPortal';
import VideoTrimControls from './composer/VideoTrimControls';
import VideoPreview from './composer/VideoPreview';
import VideoThumbnails from './composer/VideoThumbnails';
import { ComposerProvider } from './composer/ComposerContext';
// Inline trim UX; modal editor removed per request

interface ComposerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPost: (post: any) => void;
  onPostUpdate: (tempId: string, updatedPost: any) => void;
}

export default function ComposerModal({ isOpen, onClose, onPost, onPostUpdate }: ComposerModalProps) {
  const { data: session } = useSession();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const colorWheelRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Content state
  const [content, setContent] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  
  // Media state
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [videoThumbnails, setVideoThumbnails] = useState<string[]>([]);
  const [currentThumbnailIndex, setCurrentThumbnailIndex] = useState(0);
  // Video edit state
  // Inline trim (no modal)
  const [videoTrimStart, setVideoTrimStart] = useState(0);
  const [videoTrimEnd, setVideoTrimEnd] = useState(0);
  const [videoAspect, setVideoAspect] = useState<'16:9' | '4:5' | '1:1' | '9:16'>('16:9');
  const [editedThumb, setEditedThumb] = useState<string | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const ffmpegRef = useRef<any>(null);
  const [isRenderingClip, setIsRenderingClip] = useState(false);
  // Track repeated completed-without-valid-url observations to avoid perpetual processing state
  const ingestInvalidCountRef = useRef(0);
  const [videoDuration, setVideoDuration] = useState(0);
  // Single slider track and dragging state
  const trimTrackRef = useRef<HTMLDivElement | null>(null);
  const [draggingHandle, setDraggingHandle] = useState<null | 'start' | 'end'>(null);

  // External media ingestion state (must be declared before any use)
  const [externalUrl, setExternalUrl] = useState('');
  const [externalTosAccepted, setExternalTosAccepted] = useState(false);
  const videoLoadRetryRef = useRef(0);
  const mediaBaseUrlRef = useRef<string | null>(null);
  const [ingestJobId, setIngestJobId] = useState<string | null>(null);
  const [ingestStatus, setIngestStatus] = useState<string | null>(null);
  const [ingestProgress, setIngestProgress] = useState<number | null>(null);
  const [ingestError, setIngestError] = useState<string | null>(null);
  // Cloudflare Stream preview UID (when worker returns cfUid)
  const [cfUidPreview, setCfUidPreview] = useState<string | null>(null);
  // External URL helpers and gating
  const urlTrimmed = useMemo(() => externalUrl?.trim() ?? '', [externalUrl]);
  const isExternalUrlValid = useMemo(() => {
    if (!urlTrimmed) return false;
    const candidate = /^https?:\/\//i.test(urlTrimmed) ? urlTrimmed : `https://${urlTrimmed}`;
    try {
      const u = new URL(candidate);
      return !!u.host;
    } catch {
      return false;
    }
  }, [urlTrimmed]);
  // Whether there's an active ingest that should block new attempts
  const isIngestActive = useMemo(() => {
    if (!ingestJobId) return false;
    // Treat these as active; everything else (failed, error, complete, canceled) allows retry
    const s = (ingestStatus || '').toLowerCase();
    return (
      s === 'starting' ||
      s === 'queued' ||
      s === 'pending' ||
      s === 'started' ||
      s === 'running' ||
      s === 'processing' ||
      s === 'downloading' ||
      s === 'transcoding' ||
      s === 'uploading' ||
      s === 'finalizing'
    );
  }, [ingestJobId, ingestStatus]);

  // If URL and TOS are valid but we only have a stale ingest id (not active), clear it so the button can enable
  useEffect(() => {
    if (urlTrimmed && externalTosAccepted && ingestJobId && !isIngestActive) {
      setIngestJobId(null);
      setIngestStatus(null);
      setIngestProgress(null);
      // do not clear ingestError here to allow user to see last error
      console.debug('[ComposerModal] Cleared stale ingest state');
    }
  }, [urlTrimmed, externalTosAccepted, ingestJobId, isIngestActive]);
  // Computed: whether external URL attach is allowed
  const canAttachExternal = useMemo(() => {
    if (isIngestActive) return false;
    if (!externalTosAccepted) return false;
    if (!isExternalUrlValid) return false;
    return true;
  }, [externalTosAccepted, isIngestActive, isExternalUrlValid]);

  // Restore persisted external URL/TOS if a remount occurred mid-action
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('composer_external_state');
      if (!raw) return;
      const parsed = JSON.parse(raw) as { url?: string; tos?: boolean; ts?: number };
      const tooOld = parsed?.ts && Date.now() - parsed.ts > 60_000;
      if (tooOld) return;
      // Only restore if fields are empty and no active ingest yet
      if (!externalUrl && parsed?.url) setExternalUrl(parsed.url);
      if (!externalTosAccepted && typeof parsed?.tos === 'boolean') setExternalTosAccepted(parsed.tos);
      // Keep the External tab visible
      setMediaTab('external');
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Enforce playback between trimStart and trimEnd
  useEffect(() => {
    const v = previewVideoRef.current;
    if (!v) return;
    const onTimeUpdate = () => {
      if (videoTrimStart && v.currentTime < videoTrimStart - 0.05) {
        v.currentTime = videoTrimStart;
      }
      if (videoTrimEnd && v.currentTime > videoTrimEnd) {
        v.pause();
        v.currentTime = videoTrimStart || 0;
      }
    };
    v.addEventListener('timeupdate', onTimeUpdate);
    return () => v.removeEventListener('timeupdate', onTimeUpdate);
  }, [videoTrimStart, videoTrimEnd]);

  // When mediaPreview changes for video, explicitly call load() to force the browser to fetch metadata
  useEffect(() => {
    if (mediaType !== 'video') return;
    const v = previewVideoRef.current;
    if (!v) return;
    try {
      // Some browsers need an explicit load() after dynamic src updates
      v.load();
      videoLoadRetryRef.current = 0;
    } catch {}
  }, [mediaType, mediaPreview]);

  // Track base URL for retry logic
  useEffect(() => {
    if (!mediaPreview) { mediaBaseUrlRef.current = null; return; }
    try {
      const u = new URL(mediaPreview, window.location.href);
      // If we added a cache-buster, remember the base without it
      if (u.searchParams.has('t')) {
        u.searchParams.delete('t');
      }
      mediaBaseUrlRef.current = u.toString();
    } catch {
      mediaBaseUrlRef.current = mediaPreview;
    }
  }, [mediaPreview]);

  // Helper: derive source type from URL (default youtube for now)
  const detectSourceType = (url: string): 'youtube' | 'x' | 'facebook' | 'reddit' | 'tiktok' => {
    try {
      const u = new URL(url);
      const h = u.hostname.replace(/^www\./, '').toLowerCase();
      if (h.includes('youtube.com') || h === 'youtu.be') return 'youtube';
      if (h.includes('x.com') || h.includes('twitter.com')) return 'x';
      if (h.includes('facebook.com') || h.includes('fb.watch')) return 'facebook';
      if (h.includes('reddit.com')) return 'reddit';
      if (h.includes('tiktok.com')) return 'tiktok';
      return 'youtube';
    } catch { return 'youtube'; }
  };

  // Start ingestion for external URL
  const startExternalIngestion = async () => {
    // Align validation with UI gating
    const url = urlTrimmed;
    if (!url) {
      setIngestError('Please paste a URL.');
      showErrorToast('Paste a URL');
      return;
    }
    if (!isExternalUrlValid) {
      setIngestError('Enter a valid URL (include domain). Adding https:// may help.');
      showErrorToast('Invalid URL');
      return;
    }
    if (!externalTosAccepted) {
      setIngestError('Please accept the Terms of Service to proceed.');
      showErrorToast('Accept the Terms to continue');
      return;
    }
    if (ingestJobId && isIngestActive) {
      // Guard against double starts only when an ingest is truly active
      return;
    }
    setIngestError(null);
    // Optimistically show progress so the button doesn't appear stuck
    const tempId = `temp-${Date.now()}`;
    try {
      sessionStorage.setItem('composer_external_state', JSON.stringify({ url, tos: externalTosAccepted, ts: Date.now() }));
    } catch {}
    setIngestJobId(tempId);
    setIngestStatus('queued');
    setIngestProgress(0);
    try {
      const type = detectSourceType(url);
      console.debug('[ComposerModal] Starting external ingestion', { url, type });
      const res = await fetchWithTimeout('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, type, source: 'composer' }),
      }, 60000);
      
      // Handle non-OK responses with detailed error messages
      if (!res.ok) {
        let errorMsg = `Failed to create ingest job (${res.status})`;
        try {
          const errorData = await res.json();
          errorMsg = errorData.error || errorMsg;
          if (errorData.details) {
            console.error('[ComposerModal] Ingestion error details:', errorData.details);
          }
        } catch (e) {
          // If we can't parse JSON, use the status text
          errorMsg = `Failed to process video: ${res.statusText || 'Unknown error'}`;
        }
        throw new Error(errorMsg);
      }
      
      const data = await res.json();
      const id = data?.job?.id as string | undefined;
      if (!id) throw new Error('Ingest job id missing');
      
      console.debug('[ComposerModal] Ingestion started successfully', { jobId: id });
      setIngestJobId(id);
      setIngestStatus(data.job.status || 'queued');
      setIngestProgress(data.job.progress ?? 0);
      // Clear persisted snapshot; state is now owned by live job id
      try { sessionStorage.removeItem('composer_external_state'); } catch {}
    } catch (e: any) {
      const isAbort = e?.name === 'AbortError' || /aborted/i.test(e?.message || '');
      if (isAbort) {
        // Keep optimistic temp job and silently retry in background without timeout
        try {
          console.debug('[ComposerModal] Initial request timed out, retrying in background...');
          fetch('/api/ingest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              url, 
              type: detectSourceType(url),
              source: 'composer_retry'
            }),
          })
            .then(async (res) => {
              if (!res.ok) {
                console.error('[ComposerModal] Background retry failed:', res.status, res.statusText);
                return;
              }
              const data = await res.json();
              const id = data?.job?.id as string | undefined;
              if (id) {
                console.debug('[ComposerModal] Background retry succeeded, job ID:', id);
                setIngestJobId(id);
                setIngestStatus(data.job.status || 'queued');
                setIngestProgress(data.job.progress ?? 0);
                try { sessionStorage.removeItem('composer_external_state'); } catch {}
              }
            })
            .catch((error) => {
              console.error('[ComposerModal] Background retry failed:', error);
            });
        } catch (error) {
          console.error('[ComposerModal] Error in background retry:', error);
        }
        // Do not surface an error toast on abort; UI remains in queued state
      } else {
        setIngestError(e?.message || 'Failed to start ingestion');
        showErrorToast('Failed to start ingestion');
        // Revert optimistic state so user can try again
        setIngestJobId(null);
        setIngestStatus('failed');
        setIngestProgress(null);
      }
      if (process.env.NODE_ENV !== 'production') {
        console.error('[ComposerModal] startExternalIngestion error', e);
      }
    }
  };

  // Poll ingest status when a job is active
  useEffect(() => {
    if (!ingestJobId) return;
    // Do not poll for temporary IDs generated optimistically
    if (ingestJobId.startsWith('temp-')) return;
    let cancelled = false;
    const iv = setInterval(async () => {
      try {
        const r = await fetch(`/api/ingest?jobId=${ingestJobId}&t=${Date.now()}`, { cache: 'no-store' });
        if (!r.ok) {
          // If the app restarted and lost in-memory jobs, surface a clear error instead of staying stuck
          if (r.status === 404) {
            setIngestError('Ingest job not found (server restarted). Please try again.');
            setIngestStatus('failed');
            clearInterval(iv);
            setIngestJobId(null);
          }
          return;
        }
        const data = await r.json();
        const job = data?.job;
        if (!job) return;
        if (cancelled) return;
        setIngestStatus(job.status || null);
        setIngestProgress(prev => (typeof job.progress === 'number' ? job.progress : (prev ?? 0)));
        if (job.status === 'completed') {
          // If Cloudflare Stream UID is present, prefer CF preview
          if (job.cfUid) {
            setCfUidPreview(job.cfUid as string);
            setMediaType('video');
            setMediaPreview(null);
            setVideoTrimStart(0);
            setVideoTrimEnd(0);
            setEditedThumb(null);
            setVideoDuration(0);
            setShowMediaPicker(false);
            setExternalUrl('');
            setExternalTosAccepted(false);
            clearInterval(iv);
            setIngestJobId(null);
            ingestInvalidCountRef.current = 0;
            showSuccessToast('External video ingested to Cloudflare Stream.');
            return;
          }
          // Validate videoUrl or mediaUrl: must be a worker-served MP4 or known storage URL
          const url: string | undefined = job.videoUrl || job.mediaUrl;
          console.log('[ComposerModal] Ingestion completed, checking URL:', { 
            url, 
            videoUrl: job.videoUrl, 
            mediaUrl: job.mediaUrl,
            jobStatus: job.status 
          });
          const isWorkerMp4 = typeof url === 'string' && (
            // http://localhost:<any>/media/ingest/<id>.mp4
            /^https?:\/\/localhost(?::\d+)?\/media\/ingest\/.+\.mp4(\?.*)?$/i.test(url) ||
            // relative /media/ingest/<id>.mp4
            /^\/media\/ingest\/.+\.mp4(\?.*)?$/i.test(url)
          );
          const isCloudMp4 = typeof url === 'string' && /\/ingest\/.+\.mp4(\?.*)?$/i.test(url) && /^https?:\/\//.test(url) && !/youtube\.com|youtu\.be/i.test(url);
          // Dev-friendly: accept any direct .mp4 URL as playable
          const isAnyMp4 = typeof url === 'string' && /\.mp4(\?.*)?$/i.test(url) && !/googlevideo\.com\/videoplayback/i.test(url);
          // Accept placeholder URLs for development
          const isPlaceholder = typeof url === 'string' && /\/api\/media\/placeholder(\?.*)?$/i.test(url);
          // Recognize (but do not accept) YouTube page URLs and transient googlevideo streams
          const isYouTubeUrl = typeof url === 'string' && /youtube\.com\/watch\?v=|youtu\.be\//i.test(url);
          const isYouTubeStream = typeof url === 'string' && /googlevideo\.com\/videoplayback/i.test(url);
          const isFirebaseStorage = typeof url === 'string' && /firebasestorage\.googleapis\.com/i.test(url);
          console.log('[ComposerModal] URL detection results:', {
            url,
            isWorkerMp4,
            isCloudMp4,
            isAnyMp4,
            isPlaceholder,
            isYouTubeUrl,
            isYouTubeStream,
            isFirebaseStorage
          });
          // Only accept finalized, playable URLs that we can host or trust: worker-hosted MP4s, Firebase Storage, or other non-googlevideo MP4s
          if (url && (isWorkerMp4 || isCloudMp4 || isAnyMp4 || isPlaceholder || isFirebaseStorage)) {
            setExternalUrl(url);
            setMediaType('video');
            
            // Show preview when safe; skip for sources that may have CORS or expiring URLs (handled above by not accepting them)
            if ((isYouTubeUrl || isYouTubeStream) && !isFirebaseStorage) {
              setMediaPreview(null);
            } else {
              // Cache-bust to ensure fresh fetch and remount of the <video> element
              setMediaPreview(`${url}?t=${Date.now()}`);
              try { generateVideoThumbnails(url); } catch {}
            }
            
            // Set the base URL for posting
            mediaBaseUrlRef.current = url;
            
            // Close just the media picker to reveal the same composer editing view
            setShowMediaPicker(false);
            // Don't clear externalUrl for ingested content - keep it for posting
            // setExternalUrl('');
            setExternalTosAccepted(false);
            clearInterval(iv);
            // Keep ingestJobId so we can link it to the post when created
            // setIngestJobId(null);
            ingestInvalidCountRef.current = 0;
            showSuccessToast('External video ingested. You can now edit before posting.');
          } else {
            // Keep polling until we get a valid playable URL (e.g., Firebase or worker MP4). Surface a one-time warning.
            if (process.env.NODE_ENV !== 'production') {
              console.warn('Ingest completed but videoUrl/mediaUrl is not a valid MP4. Waiting...', { videoUrl: job.videoUrl, mediaUrl: job.mediaUrl, url, job });
            }
            ingestInvalidCountRef.current += 1;
            if (ingestInvalidCountRef.current >= 3) {
              // After a few attempts, stop polling and surface actionable error
              const hint = `Ingest completed but returned no playable MP4. Ensure the worker uploads or returns a hosted MP4 (Firebase/worker URL). Check env (INGEST_WORKER_URL in app; WORKER_PUBLIC_URL & INGEST_CALLBACK_URL in worker).`;
              setIngestError(hint);
              setIngestStatus('failed');
              showErrorToast('Ingest finished without a playable video. Please check worker.');
              clearInterval(iv);
              setIngestJobId(null);
            }
          }
        }
        if (job.status === 'failed') {
          setIngestError(job.error || 'Ingestion failed');
          showErrorToast('Ingestion failed');
          clearInterval(iv);
          setIngestJobId(null);
        }
      } catch {}
    }, 1000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [ingestJobId]);

  // Handle dragging across the single slider with two crop handles
  useEffect(() => {
    if (!draggingHandle) return;
    const onMove = (ev: MouseEvent | TouchEvent) => {
      const track = trimTrackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const clientX = (ev as TouchEvent).touches ? (ev as TouchEvent).touches[0].clientX : (ev as MouseEvent).clientX;
      const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
      const ratio = rect.width ? x / rect.width : 0;
      const t = Math.max(0, Math.min(videoDuration, ratio * videoDuration));
      if (draggingHandle === 'start') {
        const nextStart = Math.min(t, videoTrimEnd);
        setVideoTrimStart(nextStart);
        if (previewVideoRef.current) previewVideoRef.current.currentTime = nextStart;
      } else {
        const nextEnd = Math.max(t, videoTrimStart);
        setVideoTrimEnd(nextEnd);
        if (previewVideoRef.current && previewVideoRef.current.currentTime > nextEnd) {
          previewVideoRef.current.currentTime = nextEnd;
          previewVideoRef.current.pause();
        }
      }
    };
    const onUp = () => setDraggingHandle(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove);
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [draggingHandle, videoDuration, videoTrimStart, videoTrimEnd]);
  
  // Audio state
  const [showAudioRecorder, setShowAudioRecorder] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState('');
  const [audioTranscription, setAudioTranscription] = useState('');
  const [audioDurationSeconds, setAudioDurationSeconds] = useState<number | null>(null);
  const [currentPostId, setCurrentPostId] = useState<string | null>(null);
  
  // UI state
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [selectedGifUrl, setSelectedGifUrl] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [colorWheelScrollPosition, setColorWheelScrollPosition] = useState(0);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [mediaFilter, setMediaFilter] = useState<'all' | 'image' | 'video'>('all');
  const [mediaTab, setMediaTab] = useState<'gallery' | 'upload' | 'external'>('gallery');
  // Guard to avoid unintended auto-submit
  const [submitRequested, setSubmitRequested] = useState(false);
  
  // Toast state
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');
  const [showToast, setShowToast] = useState(false);
  
  // Color scheme state
  const [currentColorScheme, setCurrentColorScheme] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('carrot-color-scheme');
      return saved ? parseInt(saved, 10) : 0;
    }
    return 0;
  });
  
  // Expanded color schemes with full spectrum
  const colorSchemes = [
    { name: 'Ocean Breeze', gradientFromColor: '#e0eafe', gradientToColor: '#d1f7e6', gradientViaColor: '#f6e6fa' },
    { name: 'Lavender Dreams', gradientFromColor: '#f3e8ff', gradientToColor: '#fce7f3', gradientViaColor: '#e0e7ff' },
    { name: 'Sunset Glow', gradientFromColor: '#fed7aa', gradientToColor: '#fef3c7', gradientViaColor: '#fecaca' },
    { name: 'Forest Mist', gradientFromColor: '#d1fae5', gradientToColor: '#dbeafe', gradientViaColor: '#e0f2fe' },
    { name: 'Rose Garden', gradientFromColor: '#fce7f3', gradientToColor: '#e9d5ff', gradientViaColor: '#fed7d7' },
    { name: 'Crimson Fire', gradientFromColor: '#fee2e2', gradientToColor: '#fecaca', gradientViaColor: '#fca5a5' },
    { name: 'Golden Hour', gradientFromColor: '#fef3c7', gradientToColor: '#fed7aa', gradientViaColor: '#fbbf24' },
    { name: 'Emerald Valley', gradientFromColor: '#d1fae5', gradientToColor: '#a7f3d0', gradientViaColor: '#6ee7b7' },
    { name: 'Azure Sky', gradientFromColor: '#dbeafe', gradientToColor: '#bfdbfe', gradientViaColor: '#93c5fd' },
    { name: 'Violet Storm', gradientFromColor: '#e9d5ff', gradientToColor: '#d8b4fe', gradientViaColor: '#c084fc' },
    { name: 'Coral Reef', gradientFromColor: '#fed7d7', gradientToColor: '#fbb6ce', gradientViaColor: '#f687b3' },
    { name: 'Mint Fresh', gradientFromColor: '#ecfdf5', gradientToColor: '#d1fae5', gradientViaColor: '#a7f3d0' },
    { name: 'Amber Glow', gradientFromColor: '#fffbeb', gradientToColor: '#fef3c7', gradientViaColor: '#fde68a' },
    { name: 'Slate Storm', gradientFromColor: '#f8fafc', gradientToColor: '#e2e8f0', gradientViaColor: '#cbd5e1' },
    { name: 'Teal Wave', gradientFromColor: '#f0fdfa', gradientToColor: '#ccfbf1', gradientViaColor: '#99f6e4' },
    { name: 'Indigo Night', gradientFromColor: '#eef2ff', gradientToColor: '#e0e7ff', gradientViaColor: '#c7d2fe' },
    { name: 'Pink Blossom', gradientFromColor: '#fdf2f8', gradientToColor: '#fce7f3', gradientViaColor: '#fbcfe8' },
    { name: 'Lime Burst', gradientFromColor: '#f7fee7', gradientToColor: '#ecfccb', gradientViaColor: '#d9f99d' },
    { name: 'Orange Sunset', gradientFromColor: '#fff7ed', gradientToColor: '#fed7aa', gradientViaColor: '#fdba74' },
    { name: 'Purple Haze', gradientFromColor: '#faf5ff', gradientToColor: '#f3e8ff', gradientViaColor: '#e9d5ff' },
  ];
  
  // Emoji categories
  const emojiCategories = {
    'Smileys': ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳'],
    'Nature': ['🌱', '🌿', '☘️', '🍀', '🎋', '🍃', '🍂', '🍁', '🌾', '🌲', '🌳', '🌴', '🌵', '🌶️', '🍄', '🌰', '🎃', '🐚', '🌸', '🌺', '🌻', '🌹', '🥀', '🌷', '🌼', '🌙', '🌛', '🌜', '🌚', '🌕', '🌖'],
    'Food': ['🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔', '🍠'],
    'Symbols': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎']
  };

  // Close modal on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    
    if (isOpen) {
      // Ensure external URL field is clean on open
      setExternalUrl('');
      setExternalTosAccepted(false);
      // Reset posting state in case it was left true from a prior attempt
      setIsPosting(false);
      // Warm up ffmpeg to reduce first render latency (silent best-effort)
      (async () => {
        try {
          await ensureFfmpeg();
        } catch (e) {
          // Silent: will retry on submit and show user-visible error then
          console.debug('[ffmpeg] warm-up failed (will retry on submit):', e);
        }
      })();
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setContent('');
      setMediaPreview(null);
      setMediaFile(null);
      setMediaType(null);
      setAudioBlob(null);
      setAudioUrl('');
      setAudioTranscription('');
      setAudioDurationSeconds(null);
      setSelectedGifUrl(null);
      setShowGifPicker(false);
      setShowEmojiPicker(false);
      setShowAudioRecorder(false);
      setVideoThumbnails([]);
      setCurrentThumbnailIndex(0);
      setVideoTrimStart(0);
      setVideoTrimEnd(0);
      setVideoAspect('16:9');
      setEditedThumb(null);
      setVideoDuration(0);
      previewVideoRef.current = null;
      setExternalTosAccepted(false);
      setIngestJobId(null);
      setIngestStatus(null);
      setIngestProgress(null);
      setIngestError(null);
      setIsPosting(false);
      setCfUidPreview(null);
    }
  }, [isOpen]);

  // Toast helpers
  const showSuccessToast = (message: string) => {
    setToastMessage(message);
    setToastType('success');
    setShowToast(true);
  };

  const showErrorToast = (message: string) => {
    setToastMessage(message);
    setToastType('error');
    setShowToast(true);
  };

  // Random color scheme selector (client-side only to prevent hydration mismatch)
  const selectRandomColorScheme = () => {
    const availableIndices = Array.from({ length: colorSchemes.length }, (_, i) => i)
      .filter(i => i !== currentColorScheme);
    
    // Use deterministic selection based on timestamp to avoid hydration mismatch
    const seed = Date.now();
    const randomIndex = availableIndices[seed % availableIndices.length];
    setCurrentColorScheme(randomIndex);
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('carrot-color-scheme', randomIndex.toString());
    }
  };

  // Color wheel sliding functions
  const slideColorWheel = (direction: 'left' | 'right') => {
    if (colorWheelRef.current) {
      const scrollAmount = 200; // pixels to scroll
      const currentScroll = colorWheelRef.current.scrollLeft;
      const newScroll = direction === 'left' 
        ? Math.max(0, currentScroll - scrollAmount)
        : currentScroll + scrollAmount;
      
      colorWheelRef.current.scrollTo({
        left: newScroll,
        behavior: 'smooth'
      });
      setColorWheelScrollPosition(newScroll);
    }
  };

  const canScrollLeft = colorWheelScrollPosition > 0;
  const canScrollRight = colorWheelRef.current 
    ? colorWheelScrollPosition < (colorWheelRef.current.scrollWidth - colorWheelRef.current.clientWidth)
    : true;

  // GIF handlers
  const handleGifSelect = (gifUrl: string) => {
    setSelectedGifUrl(gifUrl);
    setShowGifPicker(false);
    // Clear other media
    setMediaPreview(null);
    setMediaFile(null);
    setAudioBlob(null);
    setAudioUrl('');
  };

  // Network helper: fetch with timeout using AbortController
  const fetchWithTimeout = async (input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 15000) => {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(t);
    }
  };

  // Utility: load external script once
  const loadScriptOnce = (src: string) => new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(s);
  });

  // Lazy-load and init ffmpeg.wasm (component-scope)
  const ensureFfmpeg = async () => {
    if (ffmpegRef.current?.isLoaded()) return ffmpegRef.current;
    // Prefer UMD from same-origin (CSP-friendly)
    try {
      await loadScriptOnce('/api/ffmpeg/ffmpeg.min.js');
    } catch (e) {
      throw e;
    }
    // UMD global may be exposed as FFmpegWASM or FFmpeg
    const w: any = window as any;
    const createFFmpeg =
      w?.FFmpeg?.createFFmpeg ||
      w?.FFmpegWASM?.createFFmpeg ||
      w?.FFmpegWASM?.FFmpeg?.createFFmpeg;
    if (createFFmpeg) {
      const ff = createFFmpeg({
        log: false,
        corePath: '/api/ffmpeg/ffmpeg-core.js',
      });
      await ff.load();
      ffmpegRef.current = ff;
      return ff;
    }

    // Some UMD builds expose a class FFmpeg instead of createFFmpeg.
    const FFmpegClass = w?.FFmpegWASM?.FFmpeg || w?.FFmpeg?.FFmpeg;
    if (!FFmpegClass) throw new Error('FFmpeg UMD not available');
    const inst = new FFmpegClass();
    // Create a small adapter to match createFFmpeg API used by our code
    const adapter = {
      loaded: false,
      isLoaded() { return this.loaded === true || inst.loaded === true; },
      async load() {
        await inst.load({
          corePath: '/api/ffmpeg/ffmpeg-core.js',
        });
        this.loaded = true;
      },
      async run(...args: string[]) {
        // exec expects an array of args
        return await inst.exec(args);
      },
      FS(op: string, ...rest: any[]) {
        switch (op) {
          case 'writeFile':
            return inst.writeFile(rest[0], rest[1]);
          case 'readFile':
            return inst.readFile(rest[0]);
          case 'deleteFile':
            return inst.deleteFile(rest[0]);
          default:
            throw new Error(`Unsupported FS op for UMD adapter: ${op}`);
        }
      },
    } as any;
    await adapter.load();
    ffmpegRef.current = adapter;
    return adapter;
  };

  // Produce a trimmed clip from a source URL (external-ingested video)
  const renderTrimmedClip = async (srcUrl: string, start: number, end: number): Promise<File | null> => {
    try {
      const ff = await ensureFfmpeg();
      const inName = 'input.mp4';
      const outName = 'output.mp4';
      // Fetch bytes and write to FS
      const absoluteSrc = (() => { try { return new URL(srcUrl, window.location.origin).toString(); } catch { return srcUrl; } })();
      const buf = await fetchWithTimeout(absoluteSrc, {}, 60000).then(r => r.arrayBuffer());
      ff.FS('writeFile', inName, new Uint8Array(buf));
      const ss = Math.max(0, start || 0);
      const hasEnd = end && end > ss;
      const args = [
        '-y',
        ...(ss ? ['-ss', String(ss)] : []),
        '-i', inName,
        ...(hasEnd ? ['-to', String(end)] : []),
        // Encode to a baseline mp4 similar to worker output
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-profile:v', 'baseline',
        '-level', '3.1',
        '-c:a', 'aac',
        '-movflags', '+faststart',
        outName,
      ];
      await ff.run(...args);
      const data = ff.FS('readFile', outName);
      const blob = new Blob([data.buffer], { type: 'video/mp4' });
      return new File([blob], 'edited.mp4', { type: 'video/mp4' });
    } catch (e) {
      console.warn('renderTrimmedClip failed; falling back to original', e);
      showErrorToast('Failed to render trimmed clip; posting original video.');
      return null;
    }
  };

  // Utility: convert data URL to Blob without network
  const dataUrlToBlob = (dataUrl: string): Blob => {
    const [header, data] = dataUrl.split(',');
    const isBase64 = /;base64$/i.test(header) || /;base64;/i.test(header);
    const mimeMatch = header.match(/^data:(.*?)(;|$)/i);
    const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    if (isBase64) {
      const binary = atob(data);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
      return new Blob([bytes], { type: mime });
    } else {
      const decoded = decodeURIComponent(data);
      return new Blob([decoded], { type: mime });
    }
  };

  // Media upload handlers
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const handleFileSelect = (file: File) => {
      if (!file) return;

      console.log("[DEBUG] File selected:", file.name, "Size:", Math.round(file.size / 1024 / 1024 * 100) / 100, "MB", "Type:", file.type);

      if (file.type.startsWith('image/')) {
        setMediaFile(file);
        setMediaType('image');
        const reader = new FileReader();
        reader.onload = (e) => setMediaPreview(e.target?.result as string);
        reader.readAsDataURL(file);
      } else if (file.type.startsWith('video/')) {
        setMediaFile(file);
        setMediaType('video');
        // Use createObjectURL for videos to avoid data URL size limits
        const videoUrl = URL.createObjectURL(file);
        console.log("[DEBUG] Created object URL:", videoUrl, "for file size:", file.size, "bytes");
        setMediaPreview(videoUrl);
        generateVideoThumbnails(videoUrl);
        // Initialize trim values; end will be set on metadata load
        setVideoTrimStart(0);
        setVideoTrimEnd(0);
      }
    };

    if (e.target.files) {
      handleFileSelect(e.target.files[0]);
      setEditedThumb(null);
    }
  };

  const generateVideoThumbnails = (videoUrl: string) => {
    const video = document.createElement('video');
    video.src = videoUrl;
    video.crossOrigin = 'anonymous';
    
    video.addEventListener('loadedmetadata', () => {
      const duration = video.duration;
      const thumbnails: string[] = [];
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) return;
      
      canvas.width = 320;
      canvas.height = 180;
      
      const generateThumbnail = (time: number) => {
        return new Promise<string>((resolve) => {
          const handleSeeked = () => {
            // Add small delay to ensure frame is fully loaded
            setTimeout(() => {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              resolve(canvas.toDataURL());
            }, 100);
          };
          
          video.addEventListener('seeked', handleSeeked, { once: true });
          video.currentTime = time;
        });
      };
      
      // Generate thumbnails sequentially to avoid race conditions
      const generateSequentially = async () => {
        const clamp = (t: number) => Math.max(0.05, Math.min(t, Math.max(0.1, duration - 0.1)));
        // Required rule: 5s, 20%, 40%, 60%, 80%
        const rawTimes = [
          5,
          duration * 0.2,
          duration * 0.4,
          duration * 0.6,
          duration * 0.8,
        ];
        // Clamp and ensure strictly increasing sequence
        const times: number[] = [];
        for (const rt of rawTimes) {
          const ct = clamp(rt);
          const last = times[times.length - 1] ?? 0;
          times.push(ct <= last ? clamp(last + 0.1) : ct);
        }
        
        const thumbnails: string[] = [];
        for (const time of times) {
          try {
            const thumbnail = await generateThumbnail(time);
            thumbnails.push(thumbnail);
            // Small delay between captures
            await new Promise(resolve => setTimeout(resolve, 200));
          } catch (error) {
            console.warn('Thumbnail generation failed for time:', time, error);
          }
        }
        setVideoThumbnails(thumbnails);
      };
      
      generateSequentially();
    });
  };

  // Audio handlers
  const handleAudioRecorded = async (blob: Blob, url: string, durationSeconds: number) => {
    setAudioBlob(blob);
    setAudioUrl(url);
    setAudioDurationSeconds(durationSeconds || null);
    setShowAudioRecorder(false);
    
    // Auto-transcribe
    try {
      const formData = new FormData();
      formData.append('audio', blob, 'recording.webm');
      formData.append('language', 'auto');

      const response = await fetch('/api/audio/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        setAudioTranscription(result.transcription);
        showSuccessToast('Audio transcribed successfully!');
      }
    } catch (error) {
      console.error('Transcription error:', error);
      showErrorToast('Failed to transcribe audio');
    }
  };

  // Emoji handlers
  const handleEmojiSelect = (emoji: string) => {
    if (textareaRef.current) {
      const start = textareaRef.current.selectionStart;
      const end = textareaRef.current.selectionEnd;
      const newContent = content.slice(0, start) + emoji + content.slice(end);
      setContent(newContent);
      
      // Reset cursor position
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = start + emoji.length;
          textareaRef.current.selectionEnd = start + emoji.length;
          textareaRef.current.focus();
        }
      }, 0);
    }
    setShowEmojiPicker(false);
  };

  // Color scheme handlers
  const selectColorScheme = (index: number) => {
    setCurrentColorScheme(index);
    setShowColorPicker(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('carrot-color-scheme', index.toString());
    }
  };

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submitRequested) return; // only allow when Post button explicitly clicked
    // Treat externally ingested video (no mediaFile but mediaType === 'video' with a base URL) as valid media
    const hasExternalIngestedVideo = !mediaFile && mediaType === 'video' && !!mediaBaseUrlRef.current;
    if ((!content.trim() && !mediaFile && !audioBlob && !selectedGifUrl && !externalUrl.trim() && !hasExternalIngestedVideo) || isPosting) return;
    setIsPosting(true);
    try {
      // 1) Resolve media URL to attach
      let uploadedMediaUrl: string | null = null;
      if (mediaFile) {
        try {
          const uploaded = await uploadFilesToFirebase([mediaFile], 'posts/');
          uploadedMediaUrl = Array.isArray(uploaded) && uploaded.length ? (uploaded[0] as string) : null;
        } catch (upErr) {
          console.error('Upload failed:', upErr);
          showErrorToast('Failed to upload media');
          setIsPosting(false);
          return;
        }
      }

      const derivedVideoUrl = !mediaFile && mediaType === 'video' ? (mediaBaseUrlRef.current || null) : null;
      const selectedGif = selectedGifUrl || null;
      const audioClipUrl = audioUrl || null;

      // 2) Decide if we should request background trim for externally ingested video
      const shouldBackgroundTrim = !!(
        !mediaFile && mediaType === 'video' && mediaBaseUrlRef.current &&
        ((videoTrimStart && videoTrimStart > 0) || (videoTrimEnd && videoTrimEnd > 0)) &&
        (videoTrimEnd === 0 || videoTrimEnd > videoTrimStart)
      );

      // 3) Create post payload (client-side model; API may vary)
      const tempId = `post-${Date.now()}`;
      const user = (session as any)?.user || {};
      const mediaUrlToUse = uploadedMediaUrl || derivedVideoUrl || selectedGif || null;
      const mediaKind = mediaUrlToUse ? (mediaType || (selectedGif ? 'gif' : (audioClipUrl ? 'audio' : null))) : null;
      const newPost: any = {
        id: tempId,
        content: content.trim(),
        mediaUrl: mediaUrlToUse,
        mediaType: mediaKind,
        audioUrl: audioClipUrl,
        createdAt: new Date().toISOString(),
        user,
      };

      // 4) Persist post via API (best-effort; keep optimistic update)
      try {
        const res = await fetch('/api/posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: newPost.content,
            mediaUrl: newPost.mediaUrl,
            mediaType: newPost.mediaType,
            audioUrl: newPost.audioUrl,
          }),
        });
        if (res.ok) {
          const saved = await res.json().catch(() => null);
          if (saved?.id) newPost.id = saved.id;
        }
      } catch {
        // Non-fatal; keep optimistic
      }

      // 5) Surface to feed immediately
      onPost(newPost);

      // 6) Start background trim if required
      if (shouldBackgroundTrim && mediaBaseUrlRef.current) {
        try {
          const trimRes = await fetch('/api/trim', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sourceUrl: mediaBaseUrlRef.current,
              startSec: videoTrimStart || 0,
              endSec: videoTrimEnd || 0,
              postId: newPost.id,
            }),
          });
          if (trimRes.ok) {
            const trimData = await trimRes.json().catch(() => null);
            const trimJobId = trimData?.job?.id || trimData?.jobId || null;
            if (trimJobId) {
              onPostUpdate(newPost.id, { ...newPost, status: 'processing', trimJobId });
              showSuccessToast('Trimming started in background. We will update your post when ready.');
            } else {
              showErrorToast('Trim job started but no job ID returned.');
            }
          } else {
            const t = await trimRes.text().catch(() => '');
            showErrorToast(`Failed to start trim job (${trimRes.status})${t ? ': ' + t : ''}`);
          }
        } catch (trimErr) {
          console.error('Failed to enqueue trim job:', trimErr);
          showErrorToast('Failed to start background trimming');
        }
      }

      // 7) Link ingest job to post if this was an external video
      if (ingestJobId) {
        try {
          await fetch(`/api/ingest?jobId=${ingestJobId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ postId: newPost.id })
          });
          console.log('[ComposerModal] Linked ingest job to post:', { jobId: ingestJobId, postId: newPost.id });
        } catch (err) {
          console.error('[ComposerModal] Failed to link ingest job to post:', err);
        }
      }

      // 8) Success UX
      selectRandomColorScheme();
      showSuccessToast('Posted!');
      setSubmitRequested(false);
      setShowMediaPicker(false);
      setMediaFile(null);
      setMediaPreview(null);
      setSelectedGifUrl(null);
      setAudioBlob(null);
      setAudioUrl('');
      setContent('');
    } finally {
      setIsPosting(false);
    }
  };

  // Extract large JSX block to avoid parser edge-cases
  const renderComposeModal = () => {
    if (!isOpen) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white rounded-2xl p-0 w-full max-w-2xl shadow-xl overflow-hidden">
          <ComposeHeader onClose={onClose} />
          <div className="p-6 max-h-[calc(90vh-120px)] overflow-y-auto">
            <form onSubmit={handleSubmit}>
              <ComposeTextArea value={content} onChange={setContent} textareaRef={textareaRef} />
              {cfUidPreview && (
                <div className="mb-4 relative">
                  <CFVideoPlayer uid={cfUidPreview} autoPlay muted loop controls />
                  <div className="mt-2 text-xs text-gray-700">Cloudflare Stream preview</div>
                  <button
                    type="button"
                    onClick={() => {
                      setCfUidPreview(null);
                      setMediaType(null);
                    }}
                    className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full hover:bg-black/70"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              {mediaPreview && mediaType === 'image' && (
                <div className="mb-4 relative">
                  <img src={mediaPreview} alt="Preview" className="w-full max-h-64 object-cover rounded-xl" />
                  <button
                    type="button"
                    onClick={() => {
                      setMediaPreview(null);
                      setMediaFile(null);
                      setMediaType(null);
                    }}
                    className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full hover:bg-black/70"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              {mediaType === 'video' && (
                <div className="mb-4 relative">
                  <VideoPreview
                    src={mediaPreview || ''}
                    videoRef={previewVideoRef}
                    onLoadedMetadata={(e) => {
                      const v = e.currentTarget;
                      if (v && v.duration && !isNaN(v.duration) && v.duration > 0) {
                        setVideoDuration(v.duration);
                        setVideoTrimEnd(v.duration);
                        videoLoadRetryRef.current = 0;
                      }
                    }}
                    onError={(e) => {
                      try {
                        const v = e.currentTarget as HTMLVideoElement;
                        const err = (v as any)?.error as MediaError | undefined;
                        console.error('Video failed to load', {
                          src: v?.currentSrc || (mediaPreview ?? ''),
                          readyState: v?.readyState,
                          networkState: v?.networkState,
                          errorCode: err?.code,
                          errorMsg:
                            err?.code === 1 ? 'ABORTED' :
                            err?.code === 2 ? 'NETWORK' :
                            err?.code === 3 ? 'DECODE' :
                            err?.code === 4 ? 'SRC_NOT_SUPPORTED' : undefined,
                        });

                        if (videoLoadRetryRef.current < 1) {
                          videoLoadRetryRef.current += 1;
                          const base = mediaBaseUrlRef.current || (mediaPreview ?? '');
                          const toggle = base.includes('?') ? `${base}&t=${Date.now()}` : `${base}?t=${Date.now()}`;
                          const vEl = e.currentTarget as HTMLVideoElement;
                          vEl.src = toggle;
                          try { vEl.load(); } catch {}
                          return;
                        }
                        try { showErrorToast('Could not load video preview.'); } catch {}
                      } catch {}
                    }}
                    onRemove={() => {
                      setMediaPreview(null);
                      setMediaFile(null);
                      setMediaType(null);
                      setVideoThumbnails([]);
                      setEditedThumb(null);
                      setVideoTrimStart(0);
                      setVideoTrimEnd(0);
                      setVideoAspect('16:9');
                      setVideoDuration(0);
                      setExternalUrl('');
                      mediaBaseUrlRef.current = null;
                    }}
                  />
                  <VideoThumbnails
                    thumbnails={videoThumbnails}
                    currentIndex={currentThumbnailIndex}
                    onSelect={(i) => setCurrentThumbnailIndex(i)}
                  />
                  <VideoTrimControls
                    videoDuration={videoDuration}
                    videoTrimStart={videoTrimStart}
                    videoTrimEnd={videoTrimEnd}
                    trimTrackRef={trimTrackRef}
                    setDraggingHandle={(h) => setDraggingHandle(h)}
                  />
                </div>
              )}
              {audioUrl && (
                <AudioPreview
                  audioUrl={audioUrl}
                  postId={currentPostId || 'temp'}
                  initialDurationSeconds={audioDurationSeconds ?? undefined}
                  onRemove={() => {
                    setAudioBlob(null);
                    setAudioUrl('');
                    setAudioTranscription('');
                    setAudioDurationSeconds(null);
                  }}
                />
              )}
              {isUploading && (
                <div className="mb-4">
                  <div className="text-sm text-gray-700 mb-1" role="status" aria-live="polite">Uploading and transcribing... {Math.round(uploadProgress)}%</div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                onChange={(e) => {
                  console.log("[DEBUG] File input onChange triggered");
                  if (e.target.files && e.target.files[0]) {
                    const file = e.target.files[0];
                    console.log("[DEBUG] Raw file from input:", {
                      name: file.name,
                      size: file.size,
                      type: file.type,
                      lastModified: file.lastModified
                    });
                  }
                  setShowMediaPicker(false);
                  handleImageUpload(e);
                }}
                className="hidden"
              />
              <ExternalIngestControls
                value={externalUrl}
                onChange={setExternalUrl}
                tosAccepted={externalTosAccepted}
                onTosChange={setExternalTosAccepted}
                canAttach={canAttachExternal}
                isActive={isIngestActive}
                statusLabel={ingestStatus || undefined}
                progress={ingestProgress}
                onAttach={startExternalIngestion}
              />
              {ingestError && <div className="text-sm text-red-600">{ingestError}</div>}
              <div className="flex items-center gap-3">
                <button type="button" className="px-3 py-2 rounded-md border" onClick={() => fileInputRef.current?.click()}>
                  Upload image/video
                </button>
              </div>
              <FooterActions
                count={content.length}
                onCancel={onClose}
                onSubmitClick={() => setSubmitRequested(true)}
                isPosting={isPosting}
                disabled={(() => {
                  const hasExt = !mediaFile && mediaType === 'video' && !!mediaBaseUrlRef.current;
                  return ((!content.trim() && !mediaFile && !audioBlob && !selectedGifUrl && !externalUrl.trim() && !hasExt) || isPosting || isUploading);
                })()}
              />
            </form>
          </div>
        </div>
      </div>
    );
  };

  return (
    <ComposerProvider
      value={{
        showToast,
        toastMessage,
        toastType,
        setShowToast,
        showAudioRecorder,
        setShowAudioRecorder,
      }}
    >
      <div>
        {renderComposeModal()}
        <AudioRecorderModal
          open={showAudioRecorder}
          onRecorded={handleAudioRecorded}
          onCancel={() => setShowAudioRecorder(false)}
        />
        <ToastPortal
          isVisible={showToast}
          message={toastMessage}
          type={toastType}
          onClose={() => setShowToast(false)}
        />
      </div>
    </ComposerProvider>
  );
}
