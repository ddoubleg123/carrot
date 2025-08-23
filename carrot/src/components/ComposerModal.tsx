'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
// Temporarily disable for testing gradient changes
// import { useSession } from 'next-auth/react';
import Image from 'next/image';
import { X, Camera, Mic, Image as ImageIcon, Smile, Zap, ChevronLeft, ChevronRight } from 'lucide-react';
import { uploadFilesToFirebase } from '../lib/uploadToFirebase';
import AudioRecorder from './AudioRecorder';
import AudioPlayer from './AudioPlayer';
import CFVideoPlayer from './CFVideoPlayer';
import Toast from '../app/(app)/dashboard/components/Toast';
import GifPicker from '../app/(app)/dashboard/components/GifPicker';
// Inline trim UX; modal editor removed per request

interface ComposerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPost: (post: any) => void;
  onPostUpdate: (tempId: string, updatedPost: any) => void;
}

export default function ComposerModal({ isOpen, onClose, onPost, onPostUpdate }: ComposerModalProps) {
  // Temporarily disable useSession for testing gradient changes
  // const { data: session } = useSession();
  const session = null;
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
        body: JSON.stringify({ url, type }),
      }, 60000);
      if (!res.ok) throw new Error(`Failed to create ingest job (${res.status})`);
      const data = await res.json();
      const id = data?.job?.id as string | undefined;
      if (!id) throw new Error('Ingest job id missing');
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
          fetch('/api/ingest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, type: detectSourceType(url) }),
          })
            .then(async (res) => {
              if (!res.ok) return;
              const data = await res.json();
              const id = data?.job?.id as string | undefined;
              if (id) {
                setIngestJobId(id);
                setIngestStatus(data.job.status || 'queued');
                setIngestProgress(data.job.progress ?? 0);
                try { sessionStorage.removeItem('composer_external_state'); } catch {}
              }
            })
            .catch(() => {});
        } catch {}
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
        const r = await fetch(`/api/ingest/${ingestJobId}?t=${Date.now()}`, { cache: 'no-store' });
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
          // Validate mediaUrl: must be a worker-served MP4 or known storage URL
          const url: string | undefined = job.mediaUrl;
          const isWorkerMp4 = typeof url === 'string' && (
            // http://localhost:<any>/media/ingest/<id>.mp4
            /^https?:\/\/localhost(?::\d+)?\/media\/ingest\/.+\.mp4(\?.*)?$/i.test(url) ||
            // relative /media/ingest/<id>.mp4
            /^\/media\/ingest\/.+\.mp4(\?.*)?$/i.test(url)
          );
          const isCloudMp4 = typeof url === 'string' && /\/ingest\/.+\.mp4(\?.*)?$/i.test(url) && /^https?:\/\//.test(url) && !/youtube\.com|youtu\.be/i.test(url);
          // Dev-friendly: accept any direct .mp4 URL as playable
          const isAnyMp4 = typeof url === 'string' && /\.mp4(\?.*)?$/i.test(url);
          if (url && (isWorkerMp4 || isCloudMp4 || isAnyMp4)) {
            setExternalUrl(url);
            setMediaType('video');
            // Cache-bust to ensure fresh fetch and remount of the <video> element
            setMediaPreview(`${url}?t=${Date.now()}`);
            setVideoTrimStart(0);
            setVideoTrimEnd(0);
            setEditedThumb(null);
            setVideoDuration(0);
            try { generateVideoThumbnails(url); } catch {}
            showSuccessToast('External video ingested. You can now edit before posting.');
            // Close just the media picker to reveal the same composer editing view
            setShowMediaPicker(false);
            // Clear the External URL input and TOS so it's fresh next time
            setExternalUrl('');
            setExternalTosAccepted(false);
            clearInterval(iv);
            // Keep ingestJobId so we can link it to the post when created
            // setIngestJobId(null);
            ingestInvalidCountRef.current = 0;
          } else {
            // Keep polling until we get a valid playable URL. Surface a one-time warning.
            if (process.env.NODE_ENV !== 'production') {
              console.warn('Ingest completed but mediaUrl is not a valid MP4. Waiting...', { mediaUrl: url, job });
            }
            ingestInvalidCountRef.current += 1;
            if (ingestInvalidCountRef.current >= 3) {
              // After a few attempts, stop polling and surface actionable error
              const hint = `Ingest completed but returned no playable MP4. Ensure the worker is running and env is set (INGEST_WORKER_URL in app, WORKER_PUBLIC_URL & INGEST_CALLBACK_URL in worker).`;
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

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submitRequested) return; // only allow when Post button explicitly clicked
    // Treat externally ingested video (no mediaFile but mediaType === 'video' with a base URL) as valid media
    const hasExternalIngestedVideo = !mediaFile && mediaType === 'video' && !!mediaBaseUrlRef.current;
    if ((!content.trim() && !mediaFile && !audioBlob && !selectedGifUrl && !externalUrl.trim() && !hasExternalIngestedVideo) || isPosting) return;

    setIsPosting(true);

    try {
      let uploadedMediaUrl = '';
      let thumbnailUrl = '';
      
      // Upload media if present
      if (mediaFile) {
        setIsUploading(true);
        const uploadResult = await uploadFilesToFirebase([mediaFile], 'posts');
        setUploadProgress(100);
        
        if (uploadResult.length > 0) {
          uploadedMediaUrl = uploadResult[0];
          
          // For videos, upload edited thumbnail if available, otherwise selected generated thumbnail
          if (mediaType === 'video' && (editedThumb || videoThumbnails[currentThumbnailIndex])) {
            try {
              const dataUrl = (editedThumb || videoThumbnails[currentThumbnailIndex]) as string;
              let blob: Blob;
              if (dataUrl.startsWith('data:')) {
                blob = dataUrlToBlob(dataUrl);
              } else {
                // Remote URL case
                blob = await fetchWithTimeout(dataUrl, {}, 10000).then(r => r.blob());
              }
              const thumbnailFile = new File([blob], 'thumbnail.jpg', { type: 'image/jpeg' });
              const thumbnailResult = await uploadFilesToFirebase([thumbnailFile], 'thumbnails');
              if (thumbnailResult.length > 0) {
                thumbnailUrl = thumbnailResult[0];
              }
            } catch (thumbErr) {
              console.warn('Thumbnail upload skipped due to conversion/upload error:', thumbErr);
            }
          }
        }
        setIsUploading(false);
      }

      // For external-ingested videos, we now use BACKGROUND trimming via /api/trim after creating the post.
      // Skip client-side ffmpeg rendering/upload here; the feed will show a processing state and update when done.

      // Upload audio if present
      let uploadedAudioUrl = '';
      if (audioBlob) {
        try {
          setIsUploading(true);
          const audioFile = new File([audioBlob], 'recording.webm', { type: 'audio/webm' });
          const audioResult = await uploadFilesToFirebase([audioFile], 'audio');
          if (audioResult.length > 0) {
            uploadedAudioUrl = audioResult[0];
            showSuccessToast('Audio uploaded');
          }
        } catch (audioErr) {
          console.error('Audio upload failed:', audioErr);
          showErrorToast('Audio upload failed');
        } finally {
          setIsUploading(false);
        }
      }

      // If the video came from external ingestion (no mediaFile), still upload a thumbnail if available
      if (!mediaFile && mediaType === 'video' && (editedThumb || videoThumbnails[currentThumbnailIndex])) {
        try {
          const dataUrl = (editedThumb || videoThumbnails[currentThumbnailIndex]) as string;
          let blob: Blob;
          if (dataUrl.startsWith('data:')) {
            blob = dataUrlToBlob(dataUrl);
          } else {
            blob = await fetchWithTimeout(dataUrl, {}, 10000).then(r => r.blob());
          }
          const thumbnailFile = new File([blob], 'thumbnail.jpg', { type: 'image/jpeg' });
          const thumbnailResult = await uploadFilesToFirebase([thumbnailFile], 'thumbnails');
          if (thumbnailResult.length > 0) {
            thumbnailUrl = thumbnailResult[0];
          }
        } catch (thumbErr) {
          console.warn('External video thumbnail upload skipped due to conversion/upload error:', thumbErr);
        }
      }

      // Build post payload
      const scheme = colorSchemes[currentColorScheme];
      // Determine if we will background-trim an external-ingested video
      const shouldBackgroundTrim = (!mediaFile && mediaType === 'video' && !!mediaBaseUrlRef.current) && (
        (videoTrimStart && videoTrimStart > 0) || (videoTrimEnd && videoTrimEnd > 0)
      );

      // Derive final video URL
      // - If we plan to background-trim, omit the videoUrl for now; it will be filled when the job completes
      // - Otherwise, prefer any uploaded file URL or use the ingested/base URL
      const derivedVideoUrl = mediaType === 'video'
        ? (shouldBackgroundTrim
            ? null
            : (uploadedMediaUrl || mediaBaseUrlRef.current || (externalUrl.trim() || null) || (mediaPreview ? mediaPreview.replace(/\?t=\d+$/, '') : null)))
        : null;

      const postData = {
        content: content.trim(),
        videoUrl: derivedVideoUrl,
        gifUrl: selectedGifUrl || null,
        thumbnailUrl: thumbnailUrl || null,
        audioUrl: uploadedAudioUrl || null,
        audioTranscription: audioTranscription || null,
        audioDurationSeconds: audioDurationSeconds || null,
        externalUrl: externalUrl.trim() || null,
        // Video edit metadata for reference (client already applied trim for external videos)
        videoTrimStart: (videoTrimStart || null),
        videoTrimEnd: (videoTrimEnd || null),
        videoAspect: mediaType === 'video' ? videoAspect : null,
        // Gradient/theme fields
        gradientFromColor: scheme?.gradientFromColor || null,
        gradientToColor: scheme?.gradientToColor || null,
        gradientViaColor: scheme?.gradientViaColor || null,
        // Image URLs: include when the media type is image and we uploaded successfully
        imageUrls: (mediaType === 'image' && uploadedMediaUrl) ? [uploadedMediaUrl] : null,
      } as any;
      if (process.env.NODE_ENV !== 'production') {
        console.debug('ComposerModal POST /api/posts payload:', postData);
      }

      // Quick connectivity probe to surface mixed-content/origin issues early
      try {
        await fetchWithTimeout('/api/posts', { method: 'GET', credentials: 'include' }, 5000);
      } catch (probeErr) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Connectivity probe to /api/posts failed, retrying with absolute URL', probeErr);
        }
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        if (origin) {
          try {
            await fetchWithTimeout(`${origin}/api/posts`, { method: 'GET', credentials: 'include' }, 5000);
          } catch (absErr) {
            throw new Error(`API unreachable at ${origin}/api/posts. Check network, origin/protocol, or blockers.`);
          }
        }
      }

      let response: Response | null = null;
      const payload = JSON.stringify(postData);
      try {
        if (process.env.NODE_ENV !== 'production') {
          console.debug('ComposerModal about to POST /api/posts');
        }
        response = await fetchWithTimeout('/api/posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: payload,
        }, 15000);
      } catch (err) {
        // Network error on relative path; try absolute same-origin URL
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Relative /api/posts fetch failed, retrying with absolute URL. Error:', err);
        }
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        if (origin) {
          response = await fetchWithTimeout(`${origin}/api/posts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: payload,
          }, 15000);
        } else {
          throw err; // No window origin available
        }
      }
      if (process.env.NODE_ENV !== 'production' && response) {
        console.debug('ComposerModal POST /api/posts status:', response.status);
      }

      if (response.ok) {
        const newPost = await response.json();
        if (process.env.NODE_ENV !== 'production') {
          console.debug('ComposerModal created post:', newPost?.id);
        }
        showSuccessToast('Post created successfully!');
        
        // Link ingest job to post if this was an external video
        if (ingestJobId) {
          try {
            await fetch(`/api/ingest/${ingestJobId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ postId: newPost.id })
            });
            console.log('[ComposerModal] Linked ingest job to post:', { jobId: ingestJobId, postId: newPost.id });
          } catch (err) {
            console.error('[ComposerModal] Failed to link ingest job to post:', err);
          }
        }

        // Call onPost with the new post data to update the feed
        onPost(newPost);

        // If background trim is needed, enqueue it now and optimistically mark post as processing
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
                // Attach lightweight client-side status for UI; backend does not persist these fields
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
        
        // Reset form
        setContent('');
        setMediaPreview(null);
        setMediaFile(null);
        setMediaType(null);
        setAudioBlob(null);
        setAudioUrl('');
        setAudioTranscription('');
        setAudioDurationSeconds(null);
        setSelectedGifUrl(null);
        setVideoThumbnails([]);
        setCurrentThumbnailIndex(0);
        setExternalUrl('');
        
        onClose();
      } else {
        // Attempt to read error details for visibility
        let errText = '';
        try { errText = await response.text(); } catch {}
        throw new Error(`Failed to create post (status ${response.status}) ${errText ? '- ' + errText : ''}`);
      }
    } catch (error) {
      console.error('Error creating post:', error);
      const msg = error instanceof Error ? error.message : 'Unknown error';
      showErrorToast(`Failed to create post: ${msg}`);
    } finally {
      setSubmitRequested(false);
      setIsPosting(false);
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  if (!isOpen) return null;

  const currentScheme = colorSchemes[currentColorScheme];

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <div 
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />
        
        {/* Modal */}
        <div 
          className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${currentScheme.gradientFromColor} 0%, ${currentScheme.gradientViaColor} 50%, ${currentScheme.gradientToColor} 100%)`
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/20">
            <h2 className="text-xl font-semibold text-gray-900">Create post</h2>
            <div className="flex items-center gap-2 relative">
              <button
                onClick={() => setShowColorPicker(!showColorPicker)}
                className="p-2 hover:bg-white/20 rounded-full transition-colors duration-200"
                title="Choose color scheme"
              >
                <div className="w-5 h-5 rounded-full bg-gradient-to-r from-orange-400 to-red-500 border border-gray-300"></div>
              </button>
              <button
                onClick={selectRandomColorScheme}
                className="p-2 hover:bg-white/20 rounded-full transition-colors duration-200"
                title="Random color scheme"
              >
                <Zap className="w-5 h-5 text-gray-700" />
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-full transition-colors duration-200"
              >
                <X className="w-5 h-5 text-gray-700" />
              </button>
            </div>
          </div>

          {/* Color Picker Dropdown with Sliding Mechanism */}
          {showColorPicker && (
            <div className="absolute top-16 right-6 z-10 bg-white rounded-xl shadow-lg border border-gray-200 p-4 w-80">
              <div className="text-sm font-medium text-gray-700 mb-3">Choose Color Scheme</div>
              
              {/* Horizontal Sliding Color Wheel */}
              <div className="relative">
                {/* Left Arrow */}
                <button
                  onClick={() => slideColorWheel('left')}
                  className={`absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white rounded-full shadow-md border border-gray-200 flex items-center justify-center transition-opacity duration-200 ${
                    canScrollLeft ? 'opacity-100 hover:bg-gray-50' : 'opacity-30 cursor-not-allowed'
                  }`}
                  disabled={!canScrollLeft}
                >
                  <ChevronLeft className="w-4 h-4 text-gray-600" />
                </button>

                {/* Right Arrow */}
                <button
                  onClick={() => slideColorWheel('right')}
                  className={`absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white rounded-full shadow-md border border-gray-200 flex items-center justify-center transition-opacity duration-200 ${
                    canScrollRight ? 'opacity-100 hover:bg-gray-50' : 'opacity-30 cursor-not-allowed'
                  }`}
                  disabled={!canScrollRight}
                >
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                </button>

                {/* Scrollable Color Container */}
                <div 
                  ref={colorWheelRef}
                  className="flex overflow-x-auto scrollbar-hide gap-3 pb-2 px-10" 
                  style={{ scrollBehavior: 'smooth' }}
                  onScroll={(e) => setColorWheelScrollPosition(e.currentTarget.scrollLeft)}
                >
                  {colorSchemes.map((scheme, index) => (
                    <button
                      key={index}
                      onClick={() => selectColorScheme(index)}
                      className={`relative flex-shrink-0 w-16 h-16 rounded-full border-3 transition-all duration-300 hover:scale-110 hover:shadow-lg ${
                        currentColorScheme === index ? 'border-orange-400 ring-2 ring-orange-200 scale-110' : 'border-gray-200 hover:border-gray-300'
                      }`}
                      style={{
                        background: `linear-gradient(135deg, ${scheme.gradientFromColor} 0%, ${scheme.gradientViaColor} 50%, ${scheme.gradientToColor} 100%)`
                      }}
                      title={scheme.name}
                    >
                      {currentColorScheme === index && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-4 h-4 bg-white rounded-full shadow-md border border-gray-200"></div>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                
                {/* Slide indicators */}
                <div className="flex justify-center mt-2 gap-1">
                  {Array.from({ length: Math.ceil(colorSchemes.length / 4) }).map((_, pageIndex) => (
                    <div
                      key={pageIndex}
                      className={`w-2 h-2 rounded-full transition-colors duration-200 ${
                        Math.floor(currentColorScheme / 4) === pageIndex ? 'bg-orange-400' : 'bg-gray-300'
                      }`}
                    />
                  ))}
                </div>
              </div>
              
              {/* Current scheme info */}
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="text-xs text-gray-500">Current: {colorSchemes[currentColorScheme]?.name}</div>
              </div>
            </div>
          )}

          {/* Content */}
          <div className="p-6 max-h-[calc(90vh-120px)] overflow-y-auto">
            <form onSubmit={handleSubmit}>
              {/* User Info */}
              <div className="flex items-center gap-3 mb-4">
                {/* Temporarily use fallback avatar for testing */}
                <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-medium">
                    U
                  </span>
                </div>
                <div>
                  <div className="font-medium text-gray-900">
                    Anonymous {/* session?.user?.name || 'Anonymous' */}
                  </div>
                  <div className="text-sm text-gray-600">
                    Public post
                  </div>
                </div>
              </div>

              {/* Current Color Scheme label only (removed preview box) */}
              <div className="mb-2">
                <div className="text-sm text-gray-700">Current Color Scheme: {colorSchemes[currentColorScheme]?.name}</div>
              </div>

              {/* Text Area */}
              <div className="mb-4">
                <textarea
                  ref={textareaRef}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="What's happening?"
                  className="w-full h-32 p-4 text-lg bg-white/50 border border-white/30 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent placeholder-gray-600"
                  autoFocus
                />
              </div>

              {/* Cloudflare Stream Preview (when cfUid available) */}
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

              {/* Media Preview (local or worker-served MP4) */}
              {mediaPreview && (
                <div className="mb-4 relative">
                  {mediaType === 'image' && (
                    <img src={mediaPreview} alt="Preview" className="w-full max-h-64 object-cover rounded-xl" />
                  )}
                  {mediaType === 'video' && (
                    <div>
                      <video
                        ref={(el) => { previewVideoRef.current = el; }}
                        key={mediaPreview || 'video'}
                        className="w-full max-h-64 object-cover rounded-xl"
                        controls
                        preload="metadata"
                        playsInline
                        src={mediaPreview || ''}
                        onLoadedMetadata={(e) => {
                          const v = e.currentTarget as HTMLVideoElement;
                          const d = v.duration || 0;
                          console.log("[DEBUG] Video duration from metadata:", d, "seconds =", Math.floor(d/60), "minutes");
                          console.log("[DEBUG] Video readyState:", v.readyState);
                          console.log("[DEBUG] Video src length:", v.src.length);
                          setVideoDuration(d);
                          setVideoTrimStart(0);
                          setVideoTrimEnd(d);
                        }}
                        onCanPlay={(e) => {
                          // Fallback in case loadedmetadata didn't fire
                          const v = e.currentTarget as HTMLVideoElement;
                          if (!videoDuration || !isFinite(videoDuration)) {
                            const d = v.duration || 0;
                            setVideoDuration(d);
                            if (!videoTrimEnd) setVideoTrimEnd(d);
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

                            // One-time retry: toggle cache-buster or strip it
                            if (videoLoadRetryRef.current < 1) {
                              videoLoadRetryRef.current += 1;
                              const base = mediaBaseUrlRef.current || (mediaPreview ?? '');
                              const toggle = base.includes('?') ? `${base}&t=${Date.now()}` : `${base}?t=${Date.now()}`;
                              // Attempt retry without setState to avoid re-render loops
                              v.src = toggle;
                              try { v.load(); } catch {}
                              return;
                            }
                            // Persistent failure: surface to user
                            try { showErrorToast('Could not load video preview.'); } catch {}
                          } catch {}
                        }}
                      />
                      {/* Helper text */}
                      <div className="mt-2 text-xs text-gray-700">
                        Drag the crop handles below to trim the video start and end.
                      </div>
                      {/* Inline trim controls */}
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs text-gray-700 mb-1">
                          <span>Start: {videoTrimStart.toFixed(2)}s</span>
                          <span>End: {videoTrimEnd.toFixed(2)}s</span>
                          <span>Duration: {videoDuration.toFixed(2)}s</span>
                        </div>
                        {/* Single visual track with truncation shading and draggable handles */}
                        <div ref={trimTrackRef} className="relative w-full h-3 mb-4 rounded bg-gray-200 overflow-hidden select-none touch-none">
                          {/* Shaded left (cropped) */}
                          <div
                            className="absolute top-0 left-0 h-full bg-gray-400/60"
                            style={{ width: `${videoDuration ? (Math.min(videoTrimStart, videoTrimEnd) / videoDuration) * 100 : 0}%` }}
                          />
                          {/* Shaded right (cropped) */}
                          <div
                            className="absolute top-0 right-0 h-full bg-gray-400/60"
                            style={{ width: `${videoDuration ? ((videoDuration - Math.max(videoTrimStart, videoTrimEnd)) / videoDuration) * 100 : 0}%` }}
                          />
                          {/* Selected region highlight */}
                          <div
                            className="absolute top-0 h-full bg-orange-400/50"
                            style={{
                              left: `${videoDuration ? (Math.min(videoTrimStart, videoTrimEnd) / videoDuration) * 100 : 0}%`,
                              width: `${videoDuration ? ((Math.max(videoTrimEnd, videoTrimStart) - Math.min(videoTrimStart, videoTrimEnd)) / videoDuration) * 100 : 0}%`
                            }}
                          />
                          {/* Crop handles */}
                          {/* Start handle (full-hit area) */}
                          <button
                            type="button"
                            aria-label="Trim start"
                            onMouseDown={() => setDraggingHandle('start')}
                            onTouchStart={() => setDraggingHandle('start')}
                            className="absolute -top-4 w-10 h-10 z-10 bg-transparent cursor-ew-resize transform -translate-x-1/2 touch-none"
                            style={{ left: `${videoDuration ? (Math.min(videoTrimStart, videoTrimEnd) / videoDuration) * 100 : 0}%` }}
                          >
                            <span className="pointer-events-none absolute inset-0 m-auto w-4 h-6 bg-white border-2 border-orange-500 rounded-md shadow-lg ring-2 ring-orange-300 ring-offset-2 ring-offset-white" />
                          </button>
                          {/* End handle (full-hit area) */}
                          <button
                            type="button"
                            aria-label="Trim end"
                            onMouseDown={() => setDraggingHandle('end')}
                            onTouchStart={() => setDraggingHandle('end')}
                            className="absolute -top-4 w-10 h-10 z-10 bg-transparent cursor-ew-resize transform -translate-x-1/2 touch-none"
                            style={{ left: `${videoDuration ? (Math.max(videoTrimEnd, videoTrimStart) / videoDuration) * 100 : 0}%` }}
                          >
                            <span className="pointer-events-none absolute inset-0 m-auto w-4 h-6 bg-white border-2 border-red-500 rounded-md shadow-lg ring-2 ring-red-300 ring-offset-2 ring-offset-white" />
                          </button>
                          {/* Truncation symbols above handles */}
                          <div className="absolute -top-5 text-orange-600 text-lg select-none" style={{ left: `calc(${videoDuration ? (Math.min(videoTrimStart, videoTrimEnd) / videoDuration) * 100 : 0}% - 6px)` }}>⟪</div>
                          <div className="absolute -top-5 text-red-600 text-lg select-none" style={{ left: `calc(${videoDuration ? (Math.max(videoTrimEnd, videoTrimStart) / videoDuration) * 100 : 0}% - 6px)` }}>⟫</div>
                        </div>
                        <div className="mt-1 text-xs text-gray-600">Selected clip: {(Math.max(0, videoTrimEnd - videoTrimStart)).toFixed(2)}s</div>
                      </div>
                      {videoThumbnails.length > 0 && (
                        <div className="mt-2">
                          <div className="text-sm text-gray-700 mb-2">Choose thumbnail:</div>
                          <div className="flex gap-2 overflow-x-auto">
                            {videoThumbnails.map((thumb, index) => (
                              <img
                                key={index}
                                src={thumb}
                                alt={`Thumbnail ${index + 1}`}
                                className={`w-20 h-12 object-cover rounded cursor-pointer border-2 ${
                                  currentThumbnailIndex === index ? 'border-orange-500' : 'border-transparent'
                                }`}
                                onClick={() => setCurrentThumbnailIndex(index)}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setMediaPreview(null);
                      setMediaFile(null);
                      setMediaType(null);
                      setVideoThumbnails([]);
                      setEditedThumb(null);
                      setVideoTrimStart(0);
                      setVideoTrimEnd(0);
                      setVideoAspect('16:9');
                      setVideoDuration(0);
                    }}
                    className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full hover:bg-black/70"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* GIF Preview */}
              {selectedGifUrl && (
                <div className="mb-4 relative">
                  <img src={selectedGifUrl} alt="Selected GIF" className="w-full max-h-64 object-cover rounded-xl" />
                  <button
                    type="button"
                    onClick={() => setSelectedGifUrl(null)}
                    className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full hover:bg-black/70"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Audio Preview */}
              {audioUrl && (
                <div className="mb-4">
                  <AudioPlayer
                    audioUrl={audioUrl}
                    postId={currentPostId || 'temp'}
                    initialDurationSeconds={audioDurationSeconds ?? undefined}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setAudioBlob(null);
                      setAudioUrl('');
                      setAudioTranscription('');
                      setAudioDurationSeconds(null);
                    }}
                    className="mt-2 text-sm text-red-600 hover:text-red-800"
                  >
                    Remove audio
                  </button>
                </div>
              )}

              {/* Upload Progress */}
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

              {/* Hidden file input for 'Upload from your computer' */}
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

              {/* Media Upload Buttons */}
              <div className="flex items-center gap-4 mb-6">
                <button
                  type="button"
                  onClick={() => setShowMediaPicker(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-white/30 hover:bg-white/50 rounded-full transition-colors duration-200"
                >
                  <Camera className="w-5 h-5 text-gray-700" />
                  <span className="text-sm font-medium text-gray-700">Photo/Video</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowAudioRecorder(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-white/30 hover:bg-white/50 rounded-full transition-colors duration-200"
                >
                  <Mic className="w-5 h-5 text-gray-700" />
                  <span className="text-sm font-medium text-gray-700">Audio</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowGifPicker(!showGifPicker);
                    setShowEmojiPicker(false);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-white/30 hover:bg-white/50 rounded-full transition-colors duration-200"
                >
                  <span className="text-sm font-medium text-gray-700">GIF</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowEmojiPicker(!showEmojiPicker);
                    setShowGifPicker(false);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-white/30 hover:bg-white/50 rounded-full transition-colors duration-200"
                >
                  <Smile className="w-5 h-5 text-gray-700" />
                  <span className="text-sm font-medium text-gray-700">Emoji</span>
                </button>
              </div>

              {/* Emoji Picker */}
              {showEmojiPicker && (
                <div className="mb-4 p-4 bg-white/50 rounded-xl max-h-48 overflow-y-auto">
                  {Object.entries(emojiCategories).map(([category, emojis]) => (
                    <div key={category} className="mb-3">
                      <div className="text-sm font-medium text-gray-700 mb-2">{category}</div>
                      <div className="flex flex-wrap gap-1">
                        {emojis.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => handleEmojiSelect(emoji)}
                            className="p-1 hover:bg-white/50 rounded text-xl"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* GIF Picker */}
              {showGifPicker && (
                <div className="mb-4">
                  <GifPicker 
                    isOpen={showGifPicker}
                    onClose={() => setShowGifPicker(false)}
                    onSelectGif={handleGifSelect}
                  />
                </div>
              )}

              {/* Intermediary Media Picker */}
              {showMediaPicker && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/30 p-4">
                  <div className="w-full max-w-xl bg-white rounded-2xl shadow-xl border border-gray-200 p-0 overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                      <div className="text-base font-semibold text-gray-900">Add media</div>
                      <button
                        type="button"
                        onClick={() => setShowMediaPicker(false)}
                        className="p-2 rounded-full hover:bg-gray-100"
                        aria-label="Close"
                      >
                        <X className="w-5 h-5 text-gray-600" />
                      </button>
                    </div>

                    {/* Tabs: Gallery | Upload | External URL */}
                    <div className="grid grid-cols-3">
                      {([
                        { key: 'gallery', label: 'Gallery' },
                        { key: 'upload', label: 'Upload' },
                        { key: 'external', label: 'External URL' },
                      ] as const).map((t) => (
                        <button
                          key={t.key}
                          type="button"
                          onClick={() => {
                            setMediaTab(t.key as typeof mediaTab);
                            if (t.key === 'external') {
                              // Always clear when switching into External tab
                              setExternalUrl('');
                              setExternalTosAccepted(false);
                              // Reset any stale ingestion state so button can enable
                              setIngestJobId(null);
                              setIngestStatus(null);
                              setIngestProgress(null);
                              setIngestError(null);
                            }
                          }}
                          className={`text-sm font-medium py-3 transition-colors border-b-2 ${
                            mediaTab === t.key ? 'border-orange-500 text-gray-900 bg-orange-50' : 'border-transparent text-gray-600 hover:bg-gray-50'
                          }`}
                          role="tab"
                          aria-selected={mediaTab === t.key}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>

                    {/* Body */}
                    <div className="p-5">
                      {mediaTab === 'gallery' && (
                        <>
                          {/* Filter Pills */}
                          <div className="flex gap-2 mb-4">
                            {(['all','image','video'] as const).map((key) => (
                              <button
                                key={key}
                                type="button"
                                onClick={() => setMediaFilter(key)}
                                className={`px-3 py-1.5 text-sm rounded-full border ${mediaFilter === key ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                              >
                                {key === 'all' ? 'All' : key === 'image' ? 'Images' : 'Videos'}
                              </button>
                            ))}
                          </div>

                          {/* Gallery Placeholder */}
                          <div className="min-h-[160px] flex items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50">
                            <div className="text-sm text-gray-600">No items in your gallery yet.</div>
                          </div>
                        </>
                      )}

                      {mediaTab === 'upload' && (
                        <div className="flex items-center justify-between gap-4">
                          <div className="text-sm text-gray-600">
                            Upload images or videos from your computer.
                          </div>
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="px-4 py-2 bg-gray-900 text-white rounded-full text-sm hover:bg-black"
                          >
                            Upload from your computer
                          </button>
                        </div>
                      )}

                      {mediaTab === 'external' && (
                        <div
                          className="space-y-3"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              startExternalIngestion();
                            }
                          }}
                        >
                          <input
                            type="url"
                            inputMode="url"
                            value={externalUrl}
                            onChange={(e) => setExternalUrl(e.target.value)}
                            placeholder="Transcribe or edit from Youtube, X, TikTok, FB etc"
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                            disabled={isIngestActive}
                          />
                          {/* TOS Acknowledgement */}
                          <label className="flex items-start gap-2 text-sm text-gray-700 select-none">
                            <input
                              type="checkbox"
                              checked={externalTosAccepted}
                              onChange={(e) => setExternalTosAccepted(e.target.checked)}
                              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                              disabled={isIngestActive}
                            />
                            <span>
                              I confirm I have the right to use this content and agree to the
                              {' '}<a href="/terms" target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:text-orange-700 underline">Terms of Service</a>.
                            </span>
                          </label>

                          {/* Inline validation hint */}
                          {!canAttachExternal && (
                            <div className="text-xs text-gray-600">
                              {isIngestActive
                                ? 'An ingestion is currently in progress. Please wait for it to finish or cancel it.'
                                : (!urlTrimmed
                                  ? 'Paste a URL to continue.'
                                  : (!isExternalUrlValid
                                    ? 'Enter a valid URL (include domain). Adding https:// may help.'
                                    : (!externalTosAccepted
                                      ? 'Please accept the Terms of Service to proceed.'
                                      : '')))}
                            </div>
                          )}

                          {/* Ingestion progress */}
                          {ingestJobId && (
                            <div className="space-y-1">
                              <div className="text-sm text-gray-700">
                                {ingestStatus ? `Status: ${ingestStatus}` : 'Starting...'}
                                {ingestProgress !== null && ` (${ingestProgress}%)`}
                              </div>
                              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className="h-2 bg-orange-500 transition-all duration-300"
                                  style={{ width: `${Math.max(0, Math.min(100, ingestProgress ?? 0))}%` }}
                                />
                              </div>
                              {ingestError && <div className="text-sm text-red-600">{ingestError}</div>}
                            </div>
                          )}

                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                if (!canAttachExternal) return;
                                startExternalIngestion();
                              }}
                              disabled={!canAttachExternal || (ingestJobId && isIngestActive)}
                              aria-disabled={!canAttachExternal || (ingestJobId && isIngestActive)}
                              className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {ingestJobId ? 'Processing…' : 'Attach URL'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  {content.length}/1000 characters
                </div>
                
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-6 py-2 text-gray-700 hover:bg-white/20 rounded-full transition-colors duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    onClick={() => setSubmitRequested(true)}
                    disabled={(() => {
                      const hasExternalIngestedVideo = !mediaFile && mediaType === 'video' && !!mediaBaseUrlRef.current;
                      return ((!content.trim() && !mediaFile && !audioBlob && !selectedGifUrl && !externalUrl.trim() && !hasExternalIngestedVideo) || isPosting || isUploading);
                    })()}
                    className="px-6 py-2 bg-gradient-to-r from-orange-400 to-red-500 text-white rounded-full font-medium hover:from-orange-500 hover:to-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    {isPosting ? 'Posting...' : 'Post'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
      
      {ingestError && <div className="text-sm text-red-600">{ingestError}</div>}

      {/* Audio Recorder Modal */}
      {showAudioRecorder && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl p-6 max-w-md w-full">
            <AudioRecorder
              onAudioRecorded={handleAudioRecorded}
              onCancel={() => setShowAudioRecorder(false)}
            />
          </div>
        </div>
      )}

      

      {/* Toast */}
      {showToast && (
        <Toast
          message={toastMessage}
          type={toastType}
          isVisible={showToast}
          onClose={() => setShowToast(false)}
        />
      )}
    </>
  );
}
