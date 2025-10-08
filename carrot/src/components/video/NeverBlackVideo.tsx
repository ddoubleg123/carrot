"use client";

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import MediaMetrics from '../../lib/MediaMetrics';
import MediaStateCache from '../../lib/MediaStateCache';
import MediaPreloadQueue, { TaskType } from '../../lib/MediaPreloadQueue';
import VideoPlaceholder from './VideoPlaceholder';

interface NeverBlackVideoProps {
  src?: string;
  poster?: string;
  bucket?: string;
  path?: string;
  postId: string; // Required for metrics tracking
  className?: string;
  muted?: boolean;
  playsInline?: boolean;
  controls?: boolean;
  autoPlay?: boolean;
  onVideoRef?: (el: HTMLVideoElement | null) => void;
  onLoadedMetadata?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onError?: (error: Error) => void;
  children?: React.ReactNode;
}

export default function NeverBlackVideo({
  src,
  poster,
  bucket,
  path,
  postId,
  className = "",
  muted = true,
  playsInline = true,
  controls = false,
  autoPlay = false,
  onVideoRef,
  onLoadedMetadata,
  onPlay,
  onPause,
  onError,
  children,
}: NeverBlackVideoProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [posterLoaded, setPosterLoaded] = useState(false);
  const [posterError, setPosterError] = useState(false);
  const [clientPosterUrl, setClientPosterUrl] = useState<string | null>(null);
  const [fallbackAttempt, setFallbackAttempt] = useState(0); // Track fallback attempts
  const [videoReady, setVideoReady] = useState(false); // metadata available
  const [firstFrameReady, setFirstFrameReady] = useState(false); // can paint frame
  const [isPlaying, setIsPlaying] = useState(false);
  const [ttffStarted, setTtffStarted] = useState(false);
  const [compatSupported, setCompatSupported] = useState<boolean | null>(null);
  const [compatMessage, setCompatMessage] = useState<string | null>(null);
  
  // Metrics tracking
  const metricsRef = useRef(MediaMetrics.instance);
  const stateCacheRef = useRef(MediaStateCache.instance);
  const preloadQueueRef = useRef(MediaPreloadQueue);
  
  // PHASE A.1: Guaranteed Poster Fallback Chain (proxied)
  const getPosterUrl = (): string | null => {
    // 1st Priority: Poster prop via proxy (avoid CORS/expiry)
    if (poster) {
      try {
        if (poster.startsWith('/api/img') || poster.startsWith('data:') || poster.startsWith('blob:')) return poster;
        
        // Check if URL is already heavily encoded (contains %25 which indicates double encoding)
        const isAlreadyEncoded = /%25[0-9A-Fa-f]{2}/.test(poster);
        
        if (isAlreadyEncoded) {
          // URL is already encoded, pass it directly to avoid double-encoding
          return `/api/img?url=${poster}`;
        } else {
          // URL is not encoded, encode it once
          return `/api/img?url=${encodeURIComponent(poster)}`;
        }
      } catch { 
        // Check if URL is already heavily encoded (contains %25 which indicates double encoding)
        const isAlreadyEncoded = /%25[0-9A-Fa-f]{2}/.test(poster);
        
        if (isAlreadyEncoded) {
          // URL is already encoded, pass it directly to avoid double-encoding
          return `/api/img?url=${poster}`;
        } else {
          // URL is not encoded, encode it once
          return `/api/img?url=${encodeURIComponent(poster)}`;
        }
      }
    }
    // 2nd Priority: Durable bucket/path via proxy with generatePoster fallback
    if (bucket && path) {
      return `/api/img?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(path + '/thumb.jpg')}&generatePoster=true`;
    }
    return null;
  };

  const getFallbackPosterUrl = (): string | null => {
    // Fallback path tries again using generatePoster; in case the first was a proxy url-mode
    if (bucket && path && fallbackAttempt === 1) {
      return `/api/img?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(path + '/thumb.jpg')}&generatePoster=true`;
    }
    return null;
  };
  
  // Construct URLs
  const primaryPosterUrl = getPosterUrl();
  const fallbackPosterUrl = getFallbackPosterUrl();
  const currentPosterUrl = fallbackAttempt === 0 ? primaryPosterUrl : fallbackPosterUrl;
  const effectivePosterUrl = clientPosterUrl || currentPosterUrl || undefined;
  
  // Resolve video URL via proxy or preloaded data
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [blobCleanupRef] = useState<{ current: (() => void) | null }>({ current: null });

  useEffect(() => {
    const resolveVideoUrl = async () => {
      // First, try to use preloaded data for instant loading
      if (postId) {
        try {
          const preloadedData = preloadQueueRef.current.getCompletedTask(postId, TaskType.VIDEO_PREROLL_6S);
          if (preloadedData && preloadedData.success && preloadedData.data) {
            console.log('[NeverBlackVideo] Using preloaded data for instant startup', { postId });
            // Convert ArrayBuffer to Blob, then create blob URL
            const arrayBuffer = preloadedData.data as ArrayBuffer;
            const blob = new Blob([arrayBuffer], { type: 'video/mp4' });
            const blobUrl = URL.createObjectURL(blob);
            
            // Store cleanup function
            blobCleanupRef.current = () => URL.revokeObjectURL(blobUrl);
            
            setVideoUrl(blobUrl);
            return;
          }
        } catch (e) {
          console.warn('[NeverBlackVideo] Failed to check preloaded data:', e);
        }
      }

      // Fallback to normal URL resolution
      if (bucket && path) {
        setVideoUrl(`/api/video?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(path + '/video.mp4')}`);
        // Probe codec support asynchronously (non-blocking)
        try {
          const test = document.createElement('video') as HTMLVideoElement;
          const canMp4 = test.canPlayType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"');
          if (canMp4 === 'probably') {
            setCompatSupported(true);
          } else if (canMp4 === '') {
            fetch(`/api/video/probe?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(path + '/video.mp4')}`, { cache: 'no-store' })
              .then(r => r.json().catch(() => ({})))
              .then((j) => {
                if (j && j.ok && typeof j.supported === 'boolean') {
                  setCompatSupported(j.supported);
                  if (!j.supported) setCompatMessage('Transcoding in progress for playback compatibility');
                } else {
                  setCompatSupported(null);
                }
              })
              .catch(() => setCompatSupported(null));
          } else {
            setCompatSupported(null);
          }
        } catch { setCompatSupported(null); }
        return;
      }
      if (!src) {
        setVideoUrl(null);
        return;
      }
      
      // Check if URL is already heavily encoded (contains %25 which indicates double encoding)
      const isAlreadyEncoded = /%25[0-9A-Fa-f]{2}/.test(src);
      
      try {
        const u = new URL(src, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
        if (u.pathname.startsWith('/api/video')) {
          setVideoUrl(u.toString());
          // Fire a probe for already-proxied URLs
          try {
            const test = document.createElement('video') as HTMLVideoElement;
            const canMp4 = test.canPlayType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"');
            if (canMp4 === 'probably') {
              setCompatSupported(true);
            } else if (canMp4 === '') {
              fetch(`/api/video/probe?url=${encodeURIComponent(u.toString())}`, { cache: 'no-store' })
                .then(r => r.json().catch(() => ({})))
                .then((j) => {
                  if (j && j.ok && typeof j.supported === 'boolean') {
                    setCompatSupported(j.supported);
                    if (!j.supported) setCompatMessage('Transcoding in progress for playback compatibility');
                  } else {
                    setCompatSupported(null);
                  }
                })
                .catch(() => setCompatSupported(null));
            } else {
              setCompatSupported(null);
            }
          } catch { setCompatSupported(null); }
          return;
        }
        
        if (isAlreadyEncoded) {
          // URL is already encoded, pass it directly to avoid double-encoding
          setVideoUrl(`/api/video?url=${src}`);
        } else {
          // URL is not encoded, encode it once
          setVideoUrl(`/api/video?url=${encodeURIComponent(src)}`);
        }
        // Probe via server since direct URL may be various codecs
        try {
          const test = document.createElement('video') as HTMLVideoElement;
          const canMp4 = test.canPlayType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"');
          if (canMp4 === 'probably') {
            setCompatSupported(true);
          } else if (canMp4 === '') {
            const toProbe = `/api/video?url=${encodeURIComponent(isAlreadyEncoded ? src : encodeURIComponent(src))}`;
            fetch(`/api/video/probe?url=${encodeURIComponent(toProbe)}`, { cache: 'no-store' })
              .then(r => r.json().catch(() => ({})))
              .then((j) => {
                if (j && j.ok && typeof j.supported === 'boolean') {
                  setCompatSupported(j.supported);
                  if (!j.supported) setCompatMessage('Transcoding in progress for playback compatibility');
                } else {
                  setCompatSupported(null);
                }
              })
              .catch(() => setCompatSupported(null));
          } else {
            setCompatSupported(null);
          }
        } catch { setCompatSupported(null); }
      } catch {
        if (isAlreadyEncoded) {
          // URL is already encoded, pass it directly to avoid double-encoding
          setVideoUrl(`/api/video?url=${src}`);
        } else {
          // URL is not encoded, encode it once
          setVideoUrl(`/api/video?url=${encodeURIComponent(src)}`);
        }
      }
    };

    resolveVideoUrl();

    // Cleanup blob URL on unmount or when src changes
    return () => {
      if (blobCleanupRef.current) {
        blobCleanupRef.current();
        blobCleanupRef.current = null;
      }
    };
  }, [src, bucket, path, postId]);

  const setVideoRef = (el: HTMLVideoElement | null) => {
    videoRef.current = el;
    onVideoRef?.(el);
  };

  // Check for preloaded content
  const isPosterPreloaded = currentPosterUrl ? preloadQueueRef.current.isCompleted(postId, TaskType.POSTER) : false;
  const isVideoPreloaded = videoUrl ? preloadQueueRef.current.isCompleted(postId, TaskType.VIDEO_PREROLL_6S) : false;

  // Load cached state on mount
  useEffect(() => {
    const cachedState = stateCacheRef.current.get(postId);
    if (cachedState && videoRef.current) {
      const video = videoRef.current;
      
      // Restore video state
      if (cachedState.currentTime > 0) {
        video.currentTime = cachedState.currentTime;
      }
      
      if (!cachedState.isPaused && autoPlay) {
        video.play().catch(() => {
          // Auto-play failed, that's okay
        });
      }
      
      console.log('[NeverBlackVideo] Restored cached state', {
        postId,
        currentTime: cachedState.currentTime,
        isPaused: cachedState.isPaused
      });
    }
  }, [postId, autoPlay]);

  const handlePosterLoad = () => {
    setPosterLoaded(true);
    setPosterError(false);
    
    // Track poster load completion
    metricsRef.current.endPosterLoad(postId, true, isPosterPreloaded);
    metricsRef.current.recordCacheHit('poster', isPosterPreloaded);
    
    console.log('[NeverBlackVideo] Poster loaded successfully', { 
      postId, 
      url: currentPosterUrl,
      fallbackAttempt,
      preloaded: isPosterPreloaded 
    });
  };

  const handlePosterError = () => {
    console.warn('[NeverBlackVideo] Poster load failed', { 
      postId, 
      url: currentPosterUrl, 
      fallbackAttempt 
    });
    
    // Try fallback if available
    if (fallbackAttempt === 0 && fallbackPosterUrl) {
      console.log('[NeverBlackVideo] Attempting fallback poster', { postId, fallbackUrl: fallbackPosterUrl });
      setFallbackAttempt(1);
      setPosterError(false); // Reset error state to try fallback
      return;
    }
    
    // All poster attempts failed - will show placeholder and attempt client-side generation without blocking
    setPosterError(true);
    try {
      // If we already have a generated poster, don't redo
      if (!clientPosterUrl) {
        // If metadata is ready, try immediate capture; otherwise wait for canplay
        const v = videoRef.current;
        if (v && (v.readyState ?? 0) >= 2) {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, v.videoWidth || 640);
            canvas.height = Math.max(1, v.videoHeight || 360);
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
              const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
              if (dataUrl && dataUrl.startsWith('data:image/')) {
                setClientPosterUrl(dataUrl);
                setPosterLoaded(true);
                setPosterError(false);
              }
            }
          } catch {}
        }
      }
    } catch {}
    
    // Track poster load failure
    metricsRef.current.endPosterLoad(postId, false, false, `Poster load failed after ${fallbackAttempt + 1} attempts`);
    metricsRef.current.recordError('PosterError', 'All poster URLs failed', postId, currentPosterUrl || undefined);
    
    console.warn('[NeverBlackVideo] All poster attempts failed, showing placeholder', { postId });
  };

  const handleVideoLoadedMetadata = () => {
    setVideoReady(true);
    
    // Store initial video state
    if (videoRef.current) {
      stateCacheRef.current.set(postId, {
        currentTime: videoRef.current.currentTime,
        isPaused: videoRef.current.paused,
        duration: videoRef.current.duration,
        bufferedRanges: [],
        posterLoaded: posterLoaded,
        videoElement: videoRef.current
      });
    }
    
    onLoadedMetadata?.();
  };

  const handleVideoPlay = () => {
    setIsPlaying(true);
    
    // Start TTFF tracking if not already started
    if (!ttffStarted) {
      setTtffStarted(true);
      metricsRef.current.startTTFF(postId, isVideoPreloaded);
    }
    
    // Update state cache
    stateCacheRef.current.updatePauseState(postId, false);
    
    onPlay?.();
  };

  const handleVideoPause = () => {
    setIsPlaying(false);
    
    // Update state cache and capture frozen frame
    stateCacheRef.current.updatePauseState(postId, true);
    
    // Capture frozen frame for smooth resume
    if (videoRef.current) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0);
          const frameDataURL = canvas.toDataURL('image/jpeg', 0.8);
          stateCacheRef.current.storeFrozenFrame(postId, frameDataURL);
        }
      } catch (e) {
        console.warn('[NeverBlackVideo] Failed to capture frozen frame', e);
      }
    }
    
    onPause?.();
  };

  const handleVideoTimeUpdate = () => {
    const v = videoRef.current;
    if (v) {
      stateCacheRef.current.updateTime(postId, v.currentTime);
      // If playback progressed, we can consider first frame ready
      if (!firstFrameReady && (v.currentTime > 0 || (v.readyState ?? 0) >= 2)) {
        setFirstFrameReady(true);
      }
    }
  };

  const handleVideoCanPlay = () => {
    // Mark first frame paintable
    if (!firstFrameReady) setFirstFrameReady(true);
    // End TTFF tracking on first playable frame
    if (ttffStarted) {
      metricsRef.current.endTTFF(postId, true);
      setTtffStarted(false);
    }
    // If we don't have a working poster, generate a client-side one opportunistically
    try {
      if (!posterLoaded && !clientPosterUrl && videoRef.current) {
        const v = videoRef.current;
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, v.videoWidth || 640);
        canvas.height = Math.max(1, v.videoHeight || 360);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          if (dataUrl && dataUrl.startsWith('data:image/')) {
            setClientPosterUrl(dataUrl);
            setPosterLoaded(true);
            setPosterError(false);
          }
        }
      }
    } catch {}
  };

  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const videoElement = e.currentTarget;
    const mediaError = videoElement.error;
    
    // Create detailed error information
    const errorDetails = {
      code: mediaError?.code || 'UNKNOWN',
      message: mediaError?.message || 'Unknown video error',
      networkState: videoElement.networkState,
      readyState: videoElement.readyState,
      src: videoUrl,
      postId: postId,
      timestamp: new Date().toISOString()
    };
    
    // Map error codes to human-readable messages
    const errorMessages: Record<number, string> = {
      1: 'MEDIA_ERR_ABORTED - Video loading was aborted',
      2: 'MEDIA_ERR_NETWORK - Network error occurred while loading video',
      3: 'MEDIA_ERR_DECODE - Video decoding error',
      4: 'MEDIA_ERR_SRC_NOT_SUPPORTED - Video format not supported or source not found'
    };
    
    const errorMessage = errorMessages[mediaError?.code || 0] || `Video error: ${errorDetails.message}`;
    const error = new Error(errorMessage);
    
    console.error('[NeverBlackVideo] Video error', errorDetails);
    
    // Track video error with detailed information
    metricsRef.current.recordError('VideoError', errorMessage, postId, videoUrl || undefined);
    
    // End TTFF tracking with error
    if (ttffStarted) {
      metricsRef.current.endTTFF(postId, false, errorMessage);
      setTtffStarted(false);
    }
    
    // For format errors, try to provide more helpful information
    if (mediaError?.code === 4) {
      console.warn('[NeverBlackVideo] Video format not supported. This might be due to:', {
        url: videoUrl,
        possibleCauses: [
          'Video format not supported by browser',
          'Video file is corrupted',
          'Network issues preventing proper video loading',
          'CORS issues with video source',
          'Video codec not supported'
        ]
      });
    }
    
    onError?.(error);
  };

  // Start poster load tracking when poster URL is available
  useEffect(() => {
    if (currentPosterUrl && !posterLoaded && !posterError) {
      metricsRef.current.startPosterLoad(postId, currentPosterUrl);
    }
  }, [postId, currentPosterUrl, posterLoaded, posterError, fallbackAttempt]);

  // PHASE A.1: Display Logic - NEVER show black screens
  // Keep poster/placeholder visible until the first frame is ready to paint
  const showPoster = (!firstFrameReady) && (posterLoaded || !!clientPosterUrl) && !posterError;
  const showPlaceholder = (!firstFrameReady) && (!effectivePosterUrl || posterError);
  const showLoading = (!firstFrameReady) && !posterLoaded && !posterError && !!currentPosterUrl;

  // Sticky frame: show last captured frame when paused and we have video metadata
  const cachedState = stateCacheRef.current.get(postId);
  const frozenFrame = cachedState?.frozenFrame as string | undefined;
  const showFrozenFrame = !isPlaying && !!frozenFrame && videoReady;

  // GUARANTEE: Always show something - never black
  const hasVisibleContent = showPoster || showPlaceholder || showLoading || showFrozenFrame;

  // Debug HUD toggle (works in production when localStorage.DEBUG_FEED === '1')
  const [debugHud, setDebugHud] = useState(false);
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const val = (window.localStorage?.getItem('DEBUG_FEED') || '').trim();
        setDebugHud(val === '1' || process.env.NODE_ENV === 'development');
      }
    } catch {}
  }, []);

  return (
    <div className={`relative ${className}`} style={{ aspectRatio: '16/9' }}>
      {/* Video element - fade in only after first frame is ready */}
      <video
        ref={setVideoRef}
        className="w-full h-full object-cover"
        src={videoUrl || undefined}
        poster={effectivePosterUrl} // Always provide poster if available (client or server)
        muted={muted}
        playsInline={playsInline}
        controls={controls}
        autoPlay={compatSupported === false ? false : autoPlay}
        preload="metadata"
        crossOrigin="anonymous"
        onLoadedMetadata={handleVideoLoadedMetadata}
        onPlay={handleVideoPlay}
        onPause={handleVideoPause}
        onTimeUpdate={handleVideoTimeUpdate}
        onCanPlay={handleVideoCanPlay}
        onError={handleVideoError}
        onClick={() => {
          try {
            if (videoRef.current && videoRef.current.paused) {
              void videoRef.current.play();
            }
          } catch {}
        }}
        style={{
          opacity: firstFrameReady ? 1 : 0,
          transition: 'opacity 0.3s ease'
        }}
      >
        {children}
      </video>

      {/* Frozen frame overlay (highest priority when paused) */}
      {showFrozenFrame && (
        <div className="absolute inset-0">
          <img
            src={frozenFrame}
            alt="Video frame"
            className="w-full h-full object-cover pointer-events-none"
            style={{ imageRendering: 'auto' }}
          />
          {/* Play button overlay for frozen frame (clickable) */}
          <button
            type="button"
            aria-label="Play video"
            className="absolute inset-0 flex items-center justify-center"
            onClick={() => {
              try { if (videoRef.current) { void videoRef.current.play(); } } catch {}
            }}
          >
            <div className="w-16 h-16 bg-black/50 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-white ml-1" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </div>
          </button>
        </div>
      )}

      {/* Poster overlay kept until first frame is ready */}
      {showPoster && !showFrozenFrame && (
        <div className="absolute inset-0">
          <div className="absolute inset-0 pointer-events-none">
            {clientPosterUrl ? (
              <img
                src={clientPosterUrl}
                alt="Video thumbnail"
                className="w-full h-full object-cover"
              />
            ) : (
              <Image
                src={currentPosterUrl!}
                alt="Video thumbnail"
                fill
                className="object-cover"
                onLoad={handlePosterLoad}
                onError={handlePosterError}
                priority={isPosterPreloaded}
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                unoptimized
              />
            )}
          </div>
          {/* Clickable play overlay */}
          <button
            type="button"
            aria-label="Play video"
            className="absolute inset-0 flex items-center justify-center"
            onClick={() => { try { if (videoRef.current) { void videoRef.current.play(); } } catch {} }}
          >
            <div className="w-16 h-16 bg-black/50 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-white ml-1" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </div>
          </button>
        </div>
      )}

      {/* Loading placeholder while poster is loading and first frame not ready */}
      {showLoading && !showFrozenFrame && (
        <div className="absolute inset-0">
          <div className="absolute inset-0 pointer-events-none">
            <VideoPlaceholder 
              className="w-full h-full" 
              type="loading"
              showPlayIcon={false}
            />
          </div>
          {/* Allow click-to-play even while loading */}
          <button
            type="button"
            aria-label="Play video"
            className="absolute inset-0"
            onClick={() => { try { if (videoRef.current) { void videoRef.current.play(); } } catch {} }}
          />
        </div>
      )}

      {/* Fallback placeholder - NEVER BLACK */}
      {showPlaceholder && !showFrozenFrame && (
        <div className="absolute inset-0">
          <div className="absolute inset-0 pointer-events-none">
            <VideoPlaceholder 
              className="w-full h-full" 
              type="video"
              showPlayIcon={true}
            />
          </div>
          {/* Clickable play overlay */}
          <button
            type="button"
            aria-label="Play video"
            className="absolute inset-0 flex items-center justify-center"
            onClick={() => { try { if (videoRef.current) { void videoRef.current.play(); } } catch {} }}
          >
            <div className="w-16 h-16 bg-black/50 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-white ml-1" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </div>
          </button>
        </div>
      )}

      {/* Debug indicators */}
      {debugHud && (
        <div className="absolute top-2 right-2 text-xs bg-black bg-opacity-75 text-white px-2 py-1 rounded space-y-1">
          <div>P:{isPosterPreloaded ? '✓' : '○'} V:{isVideoPreloaded ? '✓' : '○'}</div>
          <div>F:{fallbackAttempt} {posterError ? 'ERR' : posterLoaded ? 'OK' : 'LOAD'}</div>
          <div>Play:{isPlaying ? '▶' : '❚❚'} Ready:{(videoRef.current?.readyState ?? 0)} First:{firstFrameReady ? '✓' : '○'}</div>
          <div>Src:{(videoUrl || '').slice(0, 32)}...</div>
          <div>Poster:{(currentPosterUrl || '').slice(0, 32)}...</div>
          <div>Compat:{compatSupported === null ? 'unk' : compatSupported ? 'ok' : 'no'}</div>
        </div>
      )}

      {/* Codec gating banner */}
      {compatSupported === false && (
        <div className="absolute bottom-2 left-2 right-2 mx-2 px-3 py-2 text-xs rounded bg-yellow-500/90 text-black shadow">
          {compatMessage || 'Transcoding for compatibility. Video will play when ready.'}
        </div>
      )}

      {/* Emergency fallback - should never be visible */}
      {!hasVisibleContent && (
        <div className="absolute inset-0 bg-gray-200 flex items-center justify-center pointer-events-none">
          <div className="text-gray-500 text-center">
            <div className="text-4xl mb-2">📹</div>
            <div className="text-sm">Media Loading...</div>
          </div>
        </div>
      )}
    </div>
  );
}
