'use client';

import React, { useState, useEffect, useRef } from 'react';

// Resolve public env at build time to avoid using `process` at runtime on the client
const PUBLIC_BUCKET =
  process.env.NEXT_PUBLIC_FIREBASE_BUCKET ||
  process.env.FIREBASE_STORAGE_BUCKET ||
  process.env.FIREBASE_BUCKET ||
  '';

interface VideoPlayerProps {
  videoUrl: string;
  thumbnailUrl?: string | null;
  postId?: string;
  initialTranscription?: string | null;
  transcriptionStatus?: string | null;
  uploadStatus?: 'uploading' | 'uploaded' | 'processing' | 'ready' | null;
  uploadProgress?: number;
  onVideoRef?: (el: HTMLVideoElement | null) => void;
  disableNativeControls?: boolean; // when true, rely on overlay controls
}

export default function VideoPlayer({ videoUrl, thumbnailUrl, postId, initialTranscription, transcriptionStatus, uploadStatus, uploadProgress, onVideoRef, disableNativeControls = true }: VideoPlayerProps) {
  const [hasError, setHasError] = useState(false);
  const [browserInfo, setBrowserInfo] = useState<{ isChromium: boolean; supportsH264: boolean } | null>(null);
  
  // Transcription state
  const [realTranscriptionStatus, setRealTranscriptionStatus] = useState<string | null>(transcriptionStatus || null);
  const [realTranscriptionText, setRealTranscriptionText] = useState<string | null>(initialTranscription || null);
  
  // Upload and video state
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [showThumbnailOverlay, setShowThumbnailOverlay] = useState(uploadStatus === 'uploading' || uploadStatus === 'uploaded' || uploadStatus === 'processing');
  const [showInitialPoster, setShowInitialPoster] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  
  // Autoplay state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const inViewRef = useRef(false);

  // Global modal-open signal to avoid background video loads when pickers are open
  const isAnyModalOpen = () => {
    try {
      if (typeof document === 'undefined') return false;
      return document.documentElement.getAttribute('data-modal-open') === '1';
    } catch { return false; }
  };

  

  // Safely attempt play, skipping when no source is available
  const safePlay = () => {
    const el = videoRef.current;
    if (!el) return;
    // Do not autoplay if a modal is open (e.g., Gallery), to prevent flicker and background fetches
    if (isAnyModalOpen()) return;
    // 3 = NETWORK_NO_SOURCE
    if (el.networkState === 3) return;
    // Skip if no selected source yet
    if (!el.currentSrc) return;
    // Wait until metadata is available (HAVE_METADATA = 1) or better
    if (el.readyState < 1) return;
    // Ensure muted for autoplay policy
    el.muted = true;
    // Concurrency: pause other feed players to keep only one active decoder
    try {
      const others = Array.from(document.querySelectorAll('video[data-feed-player="1"]')) as HTMLVideoElement[];
      for (const v of others) {
        if (v !== el && !v.paused) {
          try { v.pause(); } catch {}
        }
      }
      el.setAttribute('data-feed-player', '1');
    } catch {}
    el.play().catch(() => {});
  };

  // Resolve playable src via proxy for Firebase/Storage URLs (avoids CORS)
  // Preference: always use path-mode (/api/video?path=...&bucket=...) when we can extract bucket+path,
  // since the server now supports Admin SDK streaming with Range for private objects. Fallback to url-mode only if needed.
  const resolvedSrc = React.useMemo(() => {
    if (!videoUrl) return '';
    try {
      const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
      const u = new URL(videoUrl, base);
      // Already our proxy: append pid if missing
      if (u.pathname.startsWith('/api/video')) {
        if (postId && !u.searchParams.has('pid')) {
          u.searchParams.set('pid', String(postId));
          return u.pathname + '?' + u.searchParams.toString();
        }
        return u.toString();
      }
      // Not proxied: wrap with /api/video?url=...
      const wrapped = new URL('/api/video', base);
      wrapped.searchParams.set('url', u.toString());
      if (postId) wrapped.searchParams.set('pid', String(postId));
      return wrapped.pathname + '?' + wrapped.searchParams.toString();
    } catch {
      try {
        // Last resort: string wrap without URL parsing
        const pidPart = postId ? `&pid=${encodeURIComponent(String(postId))}` : '';
        return `/api/video?url=${encodeURIComponent(videoUrl)}${pidPart}`;
      } catch { return videoUrl; }
    }
  }, [videoUrl, postId]);

  // Proxy poster thumbnail via /api/img to avoid CORS on Firebase/Storage URLs
  const resolvedPoster = React.useMemo(() => {
    // Provide a deterministic SVG gradient placeholder when no thumbnail is present
    if (!thumbnailUrl) {
      const seed = String(postId || 'carrot');
      let h = 0; for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
      const hueA = (h % 360);
      const hueB = ((h >> 3) % 360);
      const svg = encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
          <defs>
            <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stop-color="hsl(${hueA},70%,18%)"/>
              <stop offset="100%" stop-color="hsl(${hueB},70%,10%)"/>
            </linearGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#g)"/>
        </svg>`
      );
      return `data:image/svg+xml;charset=utf-8,${svg}`;
    }
    try {
      // Avoid double-proxying or proxying data/blob URLs
      if (thumbnailUrl.startsWith('/api/img') || thumbnailUrl.startsWith('data:') || thumbnailUrl.startsWith('blob:')) {
        return thumbnailUrl;
      }
      return `/api/img?url=${encodeURIComponent(thumbnailUrl)}`;
    } catch {
      return `/api/img?url=${encodeURIComponent(thumbnailUrl)}`;
    }
  }, [thumbnailUrl, postId]);

  // Register this element with FeedMediaManager to enforce one Active + one Warm
  useEffect(() => {
    try {
      const FeedMediaManager = require('../../../../components/video/FeedMediaManager').default as typeof import('../../../../components/video/FeedMediaManager').default;
      const el = (videoRef.current as unknown as Element) || undefined;
      if (!el) return;
      const handle = {
        id: String(postId || thumbnailUrl || resolvedSrc || 'mp4'),
        el,
        play: async () => { try { await videoRef.current?.play(); } catch {} },
        pause: () => { try { videoRef.current?.pause(); } catch {} },
        setPaused: () => {
          setIsPaused(true);
          setShowInitialPoster(true);
          try {
            videoRef.current?.pause();
          } catch {}
        },
        release: () => {
          const v = videoRef.current; if (!v) return;
          try { v.pause(); } catch {}
          try { v.removeAttribute('src'); v.load(); } catch {}
        }
      } as any;
      FeedMediaManager.inst.registerHandle(el, handle);
      const onPlay = () => { try { FeedMediaManager.inst.setActive(handle); } catch {} };
      const v = videoRef.current; v?.addEventListener('play', onPlay);
      // Pause when not sufficiently visible
      const io = new IntersectionObserver((entries) => {
        const entry = entries[0]; if (!entry) return;
        if (entry.intersectionRatio < 0.5) {
          try { v?.pause(); } catch {}
        }
      }, { threshold: [0, 0.5, 1], rootMargin: '0px', root: null });
      if (v) io.observe(v);
      return () => {
        try { v?.removeEventListener('play', onPlay); } catch {}
        try { io.disconnect(); } catch {}
        try { FeedMediaManager.inst.unregisterHandle(el); } catch {}
      };
    } catch {}
  }, [resolvedSrc, postId, thumbnailUrl]);

  // Derive a best-guess MIME type from the URL/extension to help browsers choose the decoder
  const getMimeType = (url: string): string | undefined => {
    const lower = url.split('?')[0].toLowerCase();
    if (lower.endsWith('.mp4')) return 'video/mp4';
    if (lower.endsWith('.webm')) return 'video/webm';
    if (lower.endsWith('.mov')) return 'video/quicktime';
    return undefined; // Let the browser infer if unknown
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Detect browser and codec support
    const userAgent = navigator.userAgent;
    const isChrome = /Chrome/.test(userAgent) && /Google Inc/.test(navigator.vendor);
    const isChromium = /Chrome/.test(userAgent) && !isChrome;
    
    // Test H.264 support
    const video = document.createElement('video');
    const supportsH264 = video.canPlayType('video/mp4; codecs="avc1.42E01E"') !== '';
    
    setBrowserInfo({ isChromium, supportsH264 });
  }, []);

  // Expose null on unmount
  useEffect(() => {
    return () => { try { if (onVideoRef) onVideoRef(null); } catch {} };
  }, [onVideoRef]);

  // Poll for transcription status if postId is provided
  useEffect(() => {
    if (!postId) {
      return; // Skip polling if no postId
    }
    
    // For temp IDs, show pending status immediately
    if (postId.startsWith('temp-')) {
      setRealTranscriptionStatus('pending');
      return;
    }

    let pollInterval: NodeJS.Timeout | null = null;

    const pollTranscriptionStatus = async () => {
      try {
        const response = await fetch(`/api/transcribe?postId=${postId}`, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          setRealTranscriptionStatus(data.status);
          if (data.transcription) {
            setRealTranscriptionText(data.transcription);
          }
          
          // Stop polling if transcription is completed or failed
          if (data.status === 'completed' || data.status === 'failed') {
            if (pollInterval) {
              clearInterval(pollInterval);
              pollInterval = null;
            }
          }
        }
      } catch (error) {
        // Silently handle polling errors
      }
    };

    // Start polling if transcription is pending or processing
    if (realTranscriptionStatus === 'pending' || realTranscriptionStatus === 'processing') {
      pollTranscriptionStatus(); // Initial check
      pollInterval = setInterval(pollTranscriptionStatus, 3000); // Poll every 3 seconds
    }

    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [postId, realTranscriptionStatus]);

  // Visibility-driven play/pause with hysteresis; keep src attached to avoid flicker
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    setHasError(false);
    let pauseTimer: any;
    if (isInView) {
      try {
        el.muted = true;
        if (el.src !== resolvedSrc) {
          el.src = resolvedSrc;
          el.load();
        }
        const forceAutoplay = () => { if (isInView) safePlay(); };
        el.addEventListener('loadedmetadata', forceAutoplay, { once: true });
        el.addEventListener('canplay', forceAutoplay, { once: true });
        const hidePoster = () => setShowInitialPoster(false);
        el.addEventListener('loadeddata', hidePoster, { once: true });
        el.addEventListener('canplay', hidePoster, { once: true });
      } catch {}
    } else {
      // Delay pause slightly to avoid rapid flicker at threshold
      pauseTimer = setTimeout(() => {
        try { if (!el.paused) el.pause(); } catch {}
        setIsPlaying(false);
      }, 350);
    }
    return () => { if (pauseTimer) clearTimeout(pauseTimer); };
  }, [isInView, resolvedSrc]);

  // IntersectionObserver for autoplay on scroll (with threshold hysteresis)
  useEffect(() => {
    if (!videoRef.current) return;

    // Find nearest scrollable ancestor to observe within scroll containers
    const findScrollParent = (el: HTMLElement | null): Element | null => {
      let node: HTMLElement | null = el;
      while (node && node.parentElement) {
        const style = window.getComputedStyle(node.parentElement);
        const overflowY = style.getPropertyValue('overflow-y');
        const overflow = style.getPropertyValue('overflow');
        if (/(auto|scroll)/.test(overflowY) || /(auto|scroll)/.test(overflow)) {
          return node.parentElement;
        }
        node = node.parentElement;
      }
      return null;
    };

    const rootEl = findScrollParent(videoRef.current) as Element | null;

    let lastRatio = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          lastRatio = entry.intersectionRatio;
          // Hysteresis: mark in-view only after > 0.35, out-of-view only below 0.15
          const prev = inViewRef.current;
          const nextInView = entry.intersectionRatio > 0.35 ? true : (entry.intersectionRatio < 0.15 ? false : prev);
          if (nextInView !== prev) {
            inViewRef.current = nextInView;
            setIsInView(nextInView);
          }
          if (nextInView && videoRef.current) {
            safePlay();
            setIsPlaying(true);
          } else if (!nextInView && videoRef.current && !videoRef.current.paused) {
            // Actual pausing happens in the visibility effect (with small delay)
          }
        });
      },
      { threshold: [0, 0.15, 0.35, 1], rootMargin: '0px', root: rootEl || null }
    );

    observer.observe(videoRef.current);

    return () => {
      if (videoRef.current) {
        observer.unobserve(videoRef.current);
      }
    };
  }, []);

  // Ensure autoplay when in view and video is ready; pause when out of view
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (isInView) {
      safePlay();
      setIsPlaying(true);
      // Fallback: retry play shortly after visibility in case metadata just arrived
      const t = setTimeout(() => {
        safePlay();
      }, 300);
      return () => clearTimeout(t);
    } else {
      if (!el.paused) {
        el.pause();
        setIsPlaying(false);
      }
    }
  }, [isInView]);

  // On mount, if the element is already visible, attempt to play
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    try { if (onVideoRef) onVideoRef(el); } catch {}
    // Ensure muted is set ASAP to satisfy autoplay policies
    el.muted = true;
    const rect = el.getBoundingClientRect();
    const inViewport = rect.top < window.innerHeight && rect.bottom > 0 && rect.left < window.innerWidth && rect.right > 0;
    if (inViewport) {
      safePlay();
    }
  }, []);

  const handleError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const video = e.target as HTMLVideoElement;
    
    // Only handle real video errors that would affect playback
    if (!video || !video.error) {
      return; // No video element or no error object
    }
    
    const error = video.error;
    
    // Only handle critical video errors that prevent playback
    // Error codes: 1=ABORTED, 2=NETWORK, 3=DECODE, 4=SRC_NOT_SUPPORTED
    if (!error.code || error.code <= 0) {
      return; // Ignore spurious errors
    }
    
    // Only set error state for real playback failures, don't log to console
    // This prevents spurious console errors while still handling real failures
    if (error.code >= 3) { // Only DECODE and SRC_NOT_SUPPORTED errors
      setHasError(true);
    }
    
    // Note: Console logging disabled to prevent spurious error messages
    // Real video errors will still trigger the error UI via setHasError(true)
  };

  if (hasError && browserInfo?.isChromium && !browserInfo?.supportsH264) {
    return (
      <div 
        className="bg-yellow-50 border border-yellow-200 rounded-lg p-4"
        style={{ 
          maxWidth: '550px', 
          minWidth: '320px',
          width: '100%'
        }}
      >
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800">
              Video Format Not Supported
            </h3>
            <div className="mt-2 text-sm text-yellow-700">
              <p>This video requires codecs not available in Chromium.</p>
              <p className="mt-2">
                <strong>To watch this video:</strong>
              </p>
              <ul className="mt-1 list-disc list-inside space-y-1">
                <li>Use <strong>Google Chrome</strong> instead</li>
                <li>Or <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-yellow-900">download the video</a></li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="relative">
        <video
          ref={videoRef}
          controls={!disableNativeControls}
          muted
          loop
          playsInline
          autoPlay
          preload={process.env.NEXT_PUBLIC_FEED_HLS === '0' ? 'metadata' : 'none'}
          crossOrigin="anonymous"
          poster={resolvedPoster}
          src={resolvedSrc}
          style={{ 
            width: '100%',
            maxWidth: '100%',
            height: 'auto',
            maxHeight: 'min(70vh, 600px)',
            borderRadius: '8px',
            objectFit: 'contain',
            objectPosition: 'center',
            display: 'block',
            margin: '0 auto',
            opacity: showThumbnailOverlay ? 0.7 : 1
          }}
          onError={handleError}
          onLoadedData={() => {
            setVideoLoaded(true);
            if (!isPaused) setShowInitialPoster(false);
            // Hide overlay when video is ready to play (upload complete)
            if (uploadStatus === 'ready' || !uploadStatus) {
              setShowThumbnailOverlay(false);
            }
          }}
          onLoadedMetadata={() => {
            // Attempt to begin playback as soon as metadata is available and element is in view
            if (videoRef.current && isInView) {
              safePlay();
            }
          }}
          onCanPlay={() => {
            if (videoRef.current && isInView) {
              safePlay();
            }
            if (!isPaused) setShowInitialPoster(false);
            // Additional autoplay attempt for older posts
            setTimeout(() => {
              if (videoRef.current && isInView) {
                safePlay();
              }
            }, 200);
          }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        >
          {/* Provide explicit source with MIME type hint to improve decoding compatibility */}
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          {/* Add auth parameters for Firebase Storage URLs */}
          <source src={resolvedSrc} type={getMimeType(videoUrl)} />
        </video>
        
        {/* Initial Poster/Thumbnail Overlay to avoid black box before readiness */}
        {(showInitialPoster || isBuffering || isPaused) && (
          <div className="absolute inset-0 rounded-lg overflow-hidden" aria-hidden>
            {resolvedPoster ? (
              // Use the resolved poster image if present
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={resolvedPoster}
                alt="video thumbnail"
                className="w-full h-full object-cover"
                style={{ filter: 'brightness(0.9)' }}
                loading="eager"
                decoding="async"
              />
            ) : (
              // Fallback gradient skeleton when no thumbnail is available
              <div className="w-full h-full bg-gradient-to-br from-gray-800 via-gray-900 to-black" />
            )}
            {isBuffering && (
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
                <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {isPaused && !isBuffering && (
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
                <div className="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                  <div className="w-0 h-0 border-l-[8px] border-l-white border-y-[6px] border-y-transparent ml-1" />
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Upload Progress Overlay - Only show during actual upload, not after completion */}
        {showThumbnailOverlay && uploadStatus !== 'ready' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-40 rounded-lg">
            <div className="text-center text-white">
              {uploadStatus === 'uploading' && (
                <>
                  <div className="animate-bounce text-4xl mb-2">🥕</div>
                  <p className="text-sm font-medium">Uploading video...</p>
                  {uploadProgress && (
                    <div className="mt-2 w-32 bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-orange-500 h-2 rounded-full transition-all duration-300" 
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                  )}
                </>
              )}
              {uploadStatus === 'uploaded' && (
                <>
                  <div className="animate-pulse text-4xl mb-2">🐰</div>
                  <p className="text-sm font-medium">Saving to database...</p>
                </>
              )}
              {uploadStatus === 'processing' && (
                <>
                  <div className="animate-spin text-4xl mb-2">🥕</div>
                  <p className="text-sm font-medium">Finalizing video...</p>
                </>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Inline transcription UI removed; handled by parent panel */}
    </div>
  );
}