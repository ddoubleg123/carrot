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
  const [fallbackAttempt, setFallbackAttempt] = useState(0); // Track fallback attempts
  const [videoReady, setVideoReady] = useState(false); // metadata available
  const [firstFrameReady, setFirstFrameReady] = useState(false); // can paint frame
  const [isPlaying, setIsPlaying] = useState(false);
  const [ttffStarted, setTtffStarted] = useState(false);
  
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
  
  // Resolve video URL via proxy
  const videoUrl = (() => {
    if (bucket && path) return `/api/video?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(path + '/video.mp4')}`;
    if (!src) return null;
    
    // Check if URL is already heavily encoded (contains %25 which indicates double encoding)
    const isAlreadyEncoded = /%25[0-9A-Fa-f]{2}/.test(src);
    
    try {
      const u = new URL(src, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
      if (u.pathname.startsWith('/api/video')) return u.toString();
      
      if (isAlreadyEncoded) {
        // URL is already encoded, pass it directly to avoid double-encoding
        return `/api/video?url=${src}`;
      } else {
        // URL is not encoded, encode it once
        return `/api/video?url=${encodeURIComponent(src)}`;
      }
    } catch {
      if (isAlreadyEncoded) {
        // URL is already encoded, pass it directly to avoid double-encoding
        return `/api/video?url=${src}`;
      } else {
        // URL is not encoded, encode it once
        return `/api/video?url=${encodeURIComponent(src)}`;
      }
    }
  })();

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
    
    // All poster attempts failed - will show placeholder
    setPosterError(true);
    
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
  };

  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const error = new Error(`Video load failed: ${e.currentTarget.error?.message || 'Unknown error'}`);
    console.error('[NeverBlackVideo] Video error', { postId, src: videoUrl, error });
    
    // Track video error
    metricsRef.current.recordError('VideoError', error.message, postId, videoUrl || undefined);
    
    // End TTFF tracking with error
    if (ttffStarted) {
      metricsRef.current.endTTFF(postId, false, error.message);
      setTtffStarted(false);
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
  const showPoster = (!firstFrameReady) && posterLoaded && !posterError;
  const showPlaceholder = (!firstFrameReady) && (!currentPosterUrl || posterError);
  const showLoading = (!firstFrameReady) && !posterLoaded && !posterError && currentPosterUrl;

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
        poster={currentPosterUrl || undefined} // Always provide poster if available
        muted={muted}
        playsInline={playsInline}
        controls={controls}
        autoPlay={autoPlay}
        preload="metadata"
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
