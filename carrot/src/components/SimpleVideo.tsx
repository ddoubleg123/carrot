'use client';

import React, { useState, useRef, useEffect } from 'react';

interface SimpleVideoProps {
  src: string;
  poster?: string;
  className?: string;
  controls?: boolean;
  autoPlay?: boolean;
  muted?: boolean;
  playsInline?: boolean;
  postId?: string; // Add postId for FeedMediaManager integration
  onVideoRef?: (el: HTMLVideoElement | null) => void; // Add callback for video ref
}

export default function SimpleVideo({
  src,
  poster,
  className = '',
  controls = true,
  autoPlay = false,
  muted = true,
  playsInline = true,
  postId,
  onVideoRef,
}: SimpleVideoProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // FeedMediaManager integration for single-video playback
  useEffect(() => {
    if (!postId || !containerRef.current) return;

    const registerWithFeedMediaManager = async () => {
      try {
        const { default: FeedMediaManager } = await import('./video/FeedMediaManager');
        const manager = FeedMediaManager.inst;
        
        if (manager && containerRef.current) {
          const handle = {
            id: postId,
            el: containerRef.current,
            play: async () => {
              try {
                await videoRef.current?.play();
              } catch (e) {
                console.warn('[SimpleVideo] Play failed:', e);
              }
            },
            pause: () => {
              try {
                videoRef.current?.pause();
              } catch (e) {
                console.warn('[SimpleVideo] Pause failed:', e);
              }
            },
            setPaused: () => {
              try {
                videoRef.current?.pause();
              } catch (e) {
                console.warn('[SimpleVideo] SetPaused failed:', e);
              }
            },
            release: () => {
              try {
                videoRef.current?.pause();
                if (videoRef.current) {
                  videoRef.current.removeAttribute('src');
                  videoRef.current.load();
                }
              } catch (e) {
                console.warn('[SimpleVideo] Release failed:', e);
              }
            }
          };

          manager.registerHandle(containerRef.current, handle);
          
          // Cleanup on unmount
          return () => {
            if (containerRef.current) {
              manager.unregisterHandle(containerRef.current);
            }
          };
        }
      } catch (e) {
        console.warn('[SimpleVideo] FeedMediaManager integration failed:', e);
      }
    };

    registerWithFeedMediaManager();
  }, [postId]);

  // Call onVideoRef when video element is ready
  useEffect(() => {
    if (videoRef.current && onVideoRef) {
      onVideoRef(videoRef.current);
    }
  }, [onVideoRef]);

  // Handle video play events to set as active in FeedMediaManager
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !postId) return;

    const handlePlay = async () => {
      try {
        const { default: FeedMediaManager } = await import('./video/FeedMediaManager');
        const handle = FeedMediaManager.inst.getHandleByElement(containerRef.current!);
        if (handle) {
          FeedMediaManager.inst.setActive(handle);
          console.log('[SimpleVideo] Set as active video', { postId });
        }
      } catch (e) {
        console.warn('[SimpleVideo] Failed to set as active', e);
      }
    };

    video.addEventListener('play', handlePlay);

    // Add intersection observer to handle visibility and pause when not visible
    const io = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const visible = entry.intersectionRatio >= 0.5;
      if (!visible) {
        try { 
          video.pause(); 
          console.log('[SimpleVideo] Paused video due to low visibility', { postId, intersectionRatio: entry.intersectionRatio });
        } catch {}
      }
    }, { threshold: [0, 0.5, 1] });
    
    if (containerRef.current) {
      io.observe(containerRef.current);
    }

    return () => {
      video.removeEventListener('play', handlePlay);
      io.disconnect();
    };
  }, [postId]);

  useEffect(() => {
    if (!src) {
      setHasError(true);
      setIsLoading(false);
      return;
    }

    // Simple URL construction - handle Firebase URLs properly
    let proxyUrl: string;
    
    if (src.startsWith('/api/video-simple')) {
      // Already proxied through video-simple
      proxyUrl = src;
    } else if (src.startsWith('/api/video')) {
      // Already proxied through video endpoint, use it directly
      // But check if it's double-encoded and fix it
      if (src.includes('%252F') || src.includes('%2520') || src.includes('%2525')) {
        // This is double-encoded, decode it once
        try {
          const decoded = decodeURIComponent(src);
          console.log('[SimpleVideo] Fixed double-encoded URL:', { original: src, decoded });
          proxyUrl = decoded;
        } catch (e) {
          console.warn('[SimpleVideo] Failed to decode double-encoded URL:', e);
          proxyUrl = src;
        }
      } else {
        proxyUrl = src;
      }
      
      // Range requests are handled by FeedMediaManager preloading system
      // No need to add range parameters here to avoid duplicate requests
    } else if (src.includes('firebasestorage.googleapis.com')) {
      // Check if this is a properly formatted Firebase URL (has alt=media)
      if (src.includes('alt=media')) {
        // This is a properly formatted Firebase URL, proxy it with range parameter
        let cleanSrc = src;
        
        // If the URL is already encoded (contains %2F), decode it first
        if (src.includes('%2F') || src.includes('%3F') || src.includes('%3D')) {
          try {
            cleanSrc = decodeURIComponent(src);
          } catch (e) {
            // If decoding fails, use original
            cleanSrc = src;
          }
        }
        
        // Encode it properly for the proxy (range requests handled by FeedMediaManager)
        proxyUrl = `/api/video?url=${encodeURIComponent(cleanSrc)}`;
        console.log('[SimpleVideo] Proxying Firebase URL (range handled by preload system)');
      } else {
        // This is an old Firebase URL, proxy it
        let cleanSrc = src;
        
        // If the URL is already encoded (contains %2F), decode it first
        if (src.includes('%2F') || src.includes('%3F') || src.includes('%3D')) {
          try {
            cleanSrc = decodeURIComponent(src);
          } catch (e) {
            // If decoding fails, use original
            cleanSrc = src;
          }
        }
        
        // Encode it properly for the proxy (range requests handled by FeedMediaManager)
        proxyUrl = `/api/video?url=${encodeURIComponent(cleanSrc)}`;
        console.log('[SimpleVideo] Proxying old Firebase URL (range handled by preload system)');
      }
    } else {
      // Direct URL
      proxyUrl = src;
    }

    console.log('[SimpleVideo] Original src:', src);
    console.log('[SimpleVideo] Proxy URL:', proxyUrl);
    console.log('[SimpleVideo] URL analysis:', {
      isDoubleEncoded: src.includes('%252F') || src.includes('%2520'),
      hasAltMedia: src.includes('alt=media'),
      isFirebaseUrl: src.includes('firebasestorage.googleapis.com'),
      isAlreadyProxied: src.startsWith('/api/video')
    });
    
    setVideoSrc(proxyUrl);
    // Show video immediately when source is set - don't wait for events
    setIsLoading(false);
    
    // Cleanup timeout on unmount
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
    };
  }, [src]);

  const handleLoadStart = () => {
    const startTime = Date.now();
    console.log('[SimpleVideo] Load started', { src: videoSrc, startTime });
    setHasError(false);
    
    // For Firebase Storage URLs, implement proper range request for first 6 seconds
    if (videoSrc && videoSrc.includes('firebasestorage.googleapis.com')) {
      const video = videoRef.current;
      if (video) {
        // Set up range request for first ~500KB (roughly 6 seconds of video)
        let preRollTriggered = false;
        video.addEventListener('progress', () => {
          if (!preRollTriggered && video.buffered.length > 0 && video.buffered.end(0) >= 6) {
            preRollTriggered = true;
            // We have 6 seconds buffered, we can show the video
            console.log('[SimpleVideo] Pre-roll loaded (6 seconds)', { 
              buffered: video.buffered.end(0),
              duration: `${Date.now() - startTime}ms`
            });
            setIsLoading(false);
            if (loadingTimeoutRef.current) {
              clearTimeout(loadingTimeoutRef.current);
              loadingTimeoutRef.current = null;
            }
          }
        });
        
        // Add range request header for first 6 seconds only
        video.addEventListener('loadstart', () => {
          console.log('[SimpleVideo] Requesting first 6 seconds only');
        });
      }
    }
    
    // Set a longer timeout for large videos, but still reasonable
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
    }
    loadingTimeoutRef.current = setTimeout(() => {
      const duration = Date.now() - startTime;
      console.warn('[SimpleVideo] Loading timeout - forcing video to show', { duration: `${duration}ms` });
      setIsLoading(false);
    }, 5000); // 5 second timeout for large videos
  };

  const handleLoadedData = () => {
    const duration = Date.now() - (videoRef.current?.getAttribute('data-start-time') ? parseInt(videoRef.current.getAttribute('data-start-time')!) : Date.now());
    console.log('[SimpleVideo] Data loaded', { duration: `${duration}ms` });
    setIsLoading(false);
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
  };

  const handleError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const video = e.currentTarget;
    console.error('[SimpleVideo] Video error:', {
      error: video.error,
      code: video.error?.code,
      message: video.error?.message,
      networkState: video.networkState,
      readyState: video.readyState,
      src: video.src,
      retryCount
    });
    
    // Retry once for Firebase Storage URLs
    if (retryCount < 1 && video.src.includes('firebasestorage.googleapis.com')) {
      console.log('[SimpleVideo] Retrying Firebase Storage URL...');
      setRetryCount(prev => prev + 1);
      setIsLoading(true);
      setHasError(false);
      
      // Force reload the video
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.load();
        }
      }, 1000);
      return;
    }
    
    setHasError(true);
    setIsLoading(false);
  };

  const handleCanPlay = () => {
    const duration = Date.now() - (videoRef.current?.getAttribute('data-start-time') ? parseInt(videoRef.current.getAttribute('data-start-time')!) : Date.now());
    console.log('[SimpleVideo] Can play', { duration: `${duration}ms` });
    setIsLoading(false);
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
  };

  const handleLoadedMetadata = () => {
    const duration = Date.now() - (videoRef.current?.getAttribute('data-start-time') ? parseInt(videoRef.current.getAttribute('data-start-time')!) : Date.now());
    console.log('[SimpleVideo] Metadata loaded', { duration: `${duration}ms` });
    // Show video as soon as metadata is available - this is the earliest we can show it
    setIsLoading(false);
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
  };

  const handleCanPlayThrough = () => {
    console.log('[SimpleVideo] Can play through');
    setIsLoading(false);
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
  };

  if (hasError) {
    return (
      <div className={`bg-gray-50 flex items-center justify-center ${className}`} style={{ minHeight: '200px' }}>
        <div className="text-center p-4">
          <div className="text-gray-400 mb-2">📹</div>
          <div className="text-sm text-gray-500">Video temporarily unavailable</div>
          <div className="text-xs text-gray-400 mt-1">Content may be processing</div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 bg-gray-50 flex items-center justify-center z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400 mx-auto mb-2"></div>
            <div className="text-sm text-gray-500">Loading...</div>
          </div>
        </div>
      )}
      
      {videoSrc && (
        <video
          ref={videoRef}
          src={videoSrc}
          poster={poster}
          controls={controls}
          autoPlay={autoPlay}
          muted={muted}
          playsInline={playsInline}
          onLoadStart={handleLoadStart}
          onLoadedData={handleLoadedData}
          onLoadedMetadata={handleLoadedMetadata}
          onError={handleError}
          onCanPlay={handleCanPlay}
          onCanPlayThrough={handleCanPlayThrough}
          className="w-full h-full object-contain bg-black"
          preload="auto"
          crossOrigin="anonymous"
          data-start-time={Date.now()}
        />
      )}
    </div>
  );
}
