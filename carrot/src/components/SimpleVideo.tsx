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
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!src) {
      setHasError(true);
      setIsLoading(false);
      return;
    }

    // Simple URL construction - no complex encoding
    let proxyUrl: string;
    
    if (src.startsWith('/api/video-simple')) {
      // Already proxied
      proxyUrl = src;
    } else if (src.includes('firebasestorage.googleapis.com')) {
      // Firebase URL - proxy it simply
      proxyUrl = `/api/video-simple?url=${encodeURIComponent(src)}`;
    } else {
      // Direct URL
      proxyUrl = src;
    }

    console.log('[SimpleVideo] Original src:', src);
    console.log('[SimpleVideo] Proxy URL:', proxyUrl);
    
    setVideoSrc(proxyUrl);
    setIsLoading(false);
  }, [src]);

  const handleLoadStart = () => {
    console.log('[SimpleVideo] Load started');
    setIsLoading(true);
    setHasError(false);
  };

  const handleLoadedData = () => {
    console.log('[SimpleVideo] Data loaded');
    setIsLoading(false);
  };

  const handleError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    console.error('[SimpleVideo] Video error:', e);
    setHasError(true);
    setIsLoading(false);
  };

  const handleCanPlay = () => {
    console.log('[SimpleVideo] Can play');
    setIsLoading(false);
  };

  if (hasError) {
    return (
      <div className={`bg-gray-100 flex items-center justify-center ${className}`}>
        <div className="text-center p-4">
          <div className="text-gray-500 mb-2">Video unavailable</div>
          <div className="text-xs text-gray-400">Unable to load video content</div>
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
          onError={handleError}
          onCanPlay={handleCanPlay}
          className="w-full h-full object-contain bg-black"
          preload="metadata"
        />
      )}
    </div>
  );
}
