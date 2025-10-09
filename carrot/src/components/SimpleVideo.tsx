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
  // VALIDATION: Check for valid video formats before attempting to render
  const VALID_VIDEO_FORMATS = /\.(mp4|webm|mov|m4v|avi|mkv|ogg|ogv)(\?|$)/i;
  const VALID_VIDEO_MIME_TYPES = /^(video\/|application\/x-mpegURL|application\/vnd\.apple\.mpegurl)/i;
  
  // Validate src format
  if (!src) {
    console.warn('[SimpleVideo] Missing video src', { postId });
    return (
      <div className={`${className} flex items-center justify-center bg-gray-100 rounded-xl p-8`}>
        <p className="text-gray-500 text-sm">Video unavailable</p>
      </div>
    );
  }
  
  // Check if src is a data URI with video MIME type
  const isDataUri = src.startsWith('data:');
  if (isDataUri) {
    if (!VALID_VIDEO_MIME_TYPES.test(src)) {
      console.warn('[SimpleVideo] Invalid data URI - not a video MIME type', { 
        src: src.substring(0, 100), 
        postId 
      });
      return (
        <div className={`${className} flex items-center justify-center bg-gray-100 rounded-xl p-8`}>
          <p className="text-gray-500 text-sm">Invalid video format</p>
        </div>
      );
    }
  }
  // Check if src is a proxied URL (these are already validated on the server)
  else if (src.startsWith('/api/video')) {
    // Proxied URLs are allowed - validation happens server-side
    console.log('[SimpleVideo] Using proxied video URL', { src: src.substring(0, 100), postId });
  }
  // Check if src is a direct URL with a valid video extension
  else if (!VALID_VIDEO_FORMATS.test(src)) {
    console.warn('[SimpleVideo] Invalid video src - not a supported video format', { 
      src: src.substring(0, 100), 
      postId,
      hint: 'Expected formats: .mp4, .webm, .mov, .m4v, .avi, .mkv, .ogg, .ogv'
    });
    return (
      <div className={`${className} flex items-center justify-center bg-gray-100 rounded-xl p-8`}>
        <div className="text-center">
          <p className="text-gray-500 text-sm mb-1">Invalid video format</p>
          <p className="text-gray-400 text-xs">Expected: .mp4, .webm, .mov, etc.</p>
        </div>
      </div>
    );
  }
  
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [compatSupported, setCompatSupported] = useState<boolean | null>(null);
  const [compatMessage, setCompatMessage] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [networkRetryCount, setNetworkRetryCount] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const blobCleanupRef = useRef<(() => void) | null>(null);

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
                const video = videoRef.current;
                if (!video) return;
                
                console.log('[SimpleVideo] FeedMediaManager requested play', { 
                  postId, 
                  readyState: video.readyState,
                  paused: video.paused,
                  src: video.src?.substring(0, 100)
                });
                
                // CRITICAL FIX: Wait for video to be ready before playing
                // readyState >= 2 means we have current frame data (HAVE_CURRENT_DATA or higher)
                if (video.readyState >= 2) {
                  await video.play();
                  console.log('[SimpleVideo] Play started (ready)', { postId, readyState: video.readyState });
                } else {
                  // Wait for canplay event, then play
                  console.log('[SimpleVideo] Waiting for canplay before playing', { postId, readyState: video.readyState });
                  const playWhenReady = async () => {
                    try {
                      await video.play();
                      console.log('[SimpleVideo] Play started (after canplay)', { postId });
                    } catch (playError) {
                      console.warn('[SimpleVideo] Play after canplay failed:', playError);
                    }
                    video.removeEventListener('canplay', playWhenReady);
                  };
                  video.addEventListener('canplay', playWhenReady, { once: true });
                  
                  // Fallback timeout: try to play after 2 seconds regardless
                  setTimeout(() => {
                    video.removeEventListener('canplay', playWhenReady);
                    if (video.paused) {
                      video.play().catch(e => console.warn('[SimpleVideo] Fallback play failed:', e));
                    }
                  }, 2000);
                }
              } catch (e) {
                console.warn('[SimpleVideo] Play failed:', e);
              }
            },
            pause: () => {
              try {
                const video = videoRef.current;
                if (video && !video.paused) {
                  video.pause();
                  console.log('[SimpleVideo] Paused by FeedMediaManager', { postId });
                }
              } catch (e) {
                console.warn('[SimpleVideo] Pause failed:', e);
              }
            },
            setPaused: () => {
              try {
                const video = videoRef.current;
                if (video) {
                  video.pause();
                  console.log('[SimpleVideo] SetPaused by FeedMediaManager', { postId });
                }
              } catch (e) {
                console.warn('[SimpleVideo] SetPaused failed:', e);
              }
            },
            release: () => {
              try {
                const video = videoRef.current;
                if (video) {
                  video.pause();
                  video.removeAttribute('src');
                  video.load();
                  console.log('[SimpleVideo] Released by FeedMediaManager', { postId });
                }
              } catch (e) {
                console.warn('[SimpleVideo] Release failed:', e);
              }
            },
            getScreenPosition: () => {
              try {
                const rect = containerRef.current?.getBoundingClientRect();
                if (rect) {
                  return {
                    top: rect.top,
                    bottom: rect.bottom,
                    height: rect.height
                  };
                }
              } catch (e) {
                console.warn('[SimpleVideo] getScreenPosition failed:', e);
              }
              return null;
            }
          };

          manager.registerHandle(containerRef.current, handle);
          console.log('[SimpleVideo] Registered with FeedMediaManager', { postId });
          
          // Cleanup on unmount
          return () => {
            if (containerRef.current) {
              console.log('[SimpleVideo] Unregistering from FeedMediaManager', { postId });
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

    // Add intersection observer to handle visibility and promote to full download when visible
    const io = new IntersectionObserver(async (entries) => {
      const entry = entries[0];
      if (!entry) return;
      const visible = entry.intersectionRatio >= 0.5;
      
      if (visible) {
        // Video is visible - promote to full download
        try {
          const { default: FeedMediaManager } = await import('./video/FeedMediaManager');
          const handle = FeedMediaManager.inst.getHandleByElement(containerRef.current!);
          if (handle) {
            FeedMediaManager.inst.setActive(handle);
            console.log('[SimpleVideo] Promoted visible video to full download', { postId, intersectionRatio: entry.intersectionRatio });
          }
        } catch (e) {
          console.warn('[SimpleVideo] Failed to promote visible video', e);
        }
      } else {
        // Video is not visible - pause it (preloading handled by FeedMediaManager)
        try { 
          video.pause(); 
          console.log('[SimpleVideo] Paused video due to low visibility', { postId, intersectionRatio: entry.intersectionRatio });
          // Note: Preloading is handled by FeedMediaManager to avoid duplicate requests
        } catch (e) {
          console.warn('[SimpleVideo] Failed to pause off-screen video', e);
        }
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

  // CRITICAL FIX: Comprehensive cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('[SimpleVideo] Component unmounting, cleaning up', { postId });
      
      // Clean up video element
      const video = videoRef.current;
      if (video) {
        try {
          video.pause();
          video.removeAttribute('src');
          video.load();
        } catch (e) {
          console.warn('[SimpleVideo] Video cleanup failed:', e);
        }
      }
      
      // Clean up blob URL
      if (blobCleanupRef.current) {
        blobCleanupRef.current();
        blobCleanupRef.current = null;
      }
      
      // Clean up loading timeout
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
      
      // Unregister from FeedMediaManager
      try {
        if (containerRef.current) {
          const { default: FeedMediaManager } = require('./video/FeedMediaManager');
          FeedMediaManager.inst.unregisterHandle(containerRef.current);
        }
      } catch (e) {
        console.warn('[SimpleVideo] FeedMediaManager cleanup failed:', e);
      }
    };
  }, [postId]);

  useEffect(() => {
    if (!src) {
      setHasError(true);
      setIsLoading(false);
      return;
    }

    // Check if we have preloaded data for this video first
    const checkPreloadedData = async () => {
      if (postId) {
        try {
          const { default: mediaPreloadQueue, TaskType } = await import('../lib/MediaPreloadQueue');
          const preloadedData = mediaPreloadQueue.getCompletedTask(postId, TaskType.VIDEO_PREROLL_6S);
          
          if (preloadedData && preloadedData.data) {
            console.log('[SimpleVideo] Using preloaded data for instant startup', { postId });
            // Convert ArrayBuffer to Blob, then create blob URL
            const arrayBuffer = preloadedData.data as ArrayBuffer;
            const blob = new Blob([arrayBuffer], { type: 'video/mp4' });
            const blobUrl = URL.createObjectURL(blob);
            setVideoSrc(blobUrl);
            setIsLoading(false);
            
            // Store cleanup function
            blobCleanupRef.current = () => URL.revokeObjectURL(blobUrl);
            return { success: true };
          }
        } catch (e) {
          console.warn('[SimpleVideo] Failed to check preloaded data:', e);
        }
      }
      return { success: false }; // No preloaded data available
    };

    // Try preloaded data first, then fallback to normal URL processing
    checkPreloadedData().then((result) => {
      if (result.success) {
        return; // Already handled with preloaded data
      }
      
      // Fallback to normal URL processing
      processNormalUrl();
    });

    const processNormalUrl = () => {
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
      
      // Additional check: if the URL still contains encoded Firebase URLs, try to clean it up
      if (proxyUrl.includes('firebasestorage.googleapis.com') && proxyUrl.includes('%')) {
        try {
          // Only try to parse as URL if it's an absolute URL
          if (proxyUrl.startsWith('http://') || proxyUrl.startsWith('https://')) {
            const urlObj = new URL(proxyUrl);
            const cleanUrl = `${urlObj.origin}${urlObj.pathname}${urlObj.search}`;
            console.log('[SimpleVideo] Cleaned Firebase URL:', { original: proxyUrl, cleaned: cleanUrl });
            proxyUrl = cleanUrl;
          } else {
            // For relative URLs, just decode the query parameters
            const urlParts = proxyUrl.split('?');
            if (urlParts.length === 2) {
              const [path, query] = urlParts;
              try {
                const decodedQuery = decodeURIComponent(query);
                proxyUrl = `${path}?${decodedQuery}`;
                console.log('[SimpleVideo] Decoded query parameters:', { original: proxyUrl, decoded: proxyUrl });
              } catch (e) {
                console.warn('[SimpleVideo] Failed to decode query parameters:', e);
              }
            }
          }
        } catch (e) {
          console.warn('[SimpleVideo] Failed to clean Firebase URL:', e);
        }
      }
      
      // Log URL analysis for debugging
      console.log('[SimpleVideo] URL analysis:', {
        isDoubleEncoded: src.includes('%252F'),
        hasAltMedia: src.includes('alt=media'),
        isFirebaseUrl: src.includes('firebasestorage.googleapis.com'),
        isAlreadyProxied: src.startsWith('/api/video')
      });
      
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
      // Proactively check codec support without blocking playback
      try {
        const test = document.createElement('video');
        const canMp4 = test.canPlayType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"');
        if (canMp4 === 'probably') {
          setCompatSupported(true);
        } else if (canMp4 === '') {
          // Unsure: ask server to probe when we have a concrete URL
          const toProbe = proxyUrl.startsWith('/api/video') ? proxyUrl : `/api/video?url=${encodeURIComponent(proxyUrl)}`;
          fetch(`/api/video/probe?url=${encodeURIComponent(toProbe)}`, { cache: 'no-store' })
            .then(r => r.json().catch(() => ({})))
            .then((j) => {
              if (j && j.ok && typeof j.supported === 'boolean') {
                setCompatSupported(j.supported);
                if (!j.supported) {
                  setCompatMessage('Transcoding in progress for playback compatibility');
                }
              } else {
                setCompatSupported(null);
              }
            })
            .catch(() => setCompatSupported(null));
        } else {
          // maybe: allow but keep an eye
          setCompatSupported(null);
        }
      } catch {
        setCompatSupported(null);
      }

      // Show video immediately when source is set - don't wait for events
      setIsLoading(false);
    }; // Close processNormalUrl function
    
    // Cleanup timeout and blob URLs on unmount
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
      // Clean up blob URL if it exists
      if (blobCleanupRef.current) {
        blobCleanupRef.current();
        blobCleanupRef.current = null;
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
    
    // Check if this is a network protocol error
    const isNetworkError = video.error?.code === MediaError.MEDIA_ERR_NETWORK ||
                          video.error?.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED ||
                          video.src.includes('firebasestorage.googleapis.com');
    
    // Retry for network errors with exponential backoff
    const maxRetries = isNetworkError ? 3 : 1;
    const currentRetryCount = isNetworkError ? networkRetryCount : retryCount;
    
    if (currentRetryCount < maxRetries) {
      console.log('[SimpleVideo] Retrying video load...', { 
        retryCount: currentRetryCount + 1, 
        maxRetries,
        errorCode: video.error?.code,
        isNetworkError,
        src: video.src 
      });
      
      if (isNetworkError) {
        setNetworkRetryCount(prev => prev + 1);
      } else {
        setRetryCount(prev => prev + 1);
      }
      
      setIsLoading(true);
      setHasError(false);
      
      // Exponential backoff for retries
      const delay = Math.min(1000 * Math.pow(2, currentRetryCount), 8000);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.load();
        }
      }, delay);
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
