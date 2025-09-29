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
}

export default function SimpleVideo({
  src,
  poster,
  className = '',
  controls = true,
  autoPlay = false,
  muted = true,
  playsInline = true,
}: SimpleVideoProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
      proxyUrl = src;
    } else if (src.includes('firebasestorage.googleapis.com')) {
      // Check if this is a properly formatted Firebase URL (has alt=media)
      if (src.includes('alt=media')) {
        // This is a properly formatted Firebase URL, use it directly
        proxyUrl = src;
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
        
        // Now encode it properly for the proxy
        proxyUrl = `/api/video-simple?url=${encodeURIComponent(cleanSrc)}`;
      }
    } else {
      // Direct URL
      proxyUrl = src;
    }

    console.log('[SimpleVideo] Original src:', src);
    console.log('[SimpleVideo] Proxy URL:', proxyUrl);
    
    setVideoSrc(proxyUrl);
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
    setIsLoading(true);
    setHasError(false);
    
    // Set a timeout to prevent infinite loading
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
    }
    loadingTimeoutRef.current = setTimeout(() => {
      const duration = Date.now() - startTime;
      console.warn('[SimpleVideo] Loading timeout - forcing video to show', { duration: `${duration}ms` });
      setIsLoading(false);
    }, 10000); // 10 second timeout
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
    // Show video as soon as metadata is available, don't wait for full buffering
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
    <div className={`relative ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center z-10">
          <div className="text-gray-500">Loading video...</div>
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
