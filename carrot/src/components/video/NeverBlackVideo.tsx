"use client";

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';

interface NeverBlackVideoProps {
  src?: string;
  poster?: string;
  bucket?: string;
  path?: string;
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

// Neutral placeholder for when poster fails
const VideoPlaceholder: React.FC<{ className?: string }> = ({ className }) => (
  <div className={`bg-gray-900 flex items-center justify-center ${className}`}>
    <div className="text-gray-400 text-center">
      <div className="w-16 h-16 mx-auto mb-2 opacity-50">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z"/>
        </svg>
      </div>
      <div className="text-sm">Video</div>
    </div>
  </div>
);

export default function NeverBlackVideo({
  src,
  poster,
  bucket,
  path,
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
  const [videoReady, setVideoReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Construct poster URL
  const posterUrl = poster || 
    (bucket && path ? `/api/img?bucket=${bucket}&path=${path}/thumb.jpg&generatePoster=true` : null);
  
  // Construct video URL  
  const videoUrl = src || 
    (bucket && path ? `/api/video?bucket=${bucket}&path=${path}/video.mp4` : null);

  const setVideoRef = (el: HTMLVideoElement | null) => {
    videoRef.current = el;
    onVideoRef?.(el);
  };

  const handlePosterLoad = () => {
    setPosterLoaded(true);
    setPosterError(false);
  };

  const handlePosterError = () => {
    setPosterError(true);
    console.warn('[NeverBlackVideo] Poster load failed', { posterUrl });
  };

  const handleVideoLoadedMetadata = () => {
    setVideoReady(true);
    onLoadedMetadata?.();
  };

  const handleVideoPlay = () => {
    setIsPlaying(true);
    onPlay?.();
  };

  const handleVideoPause = () => {
    setIsPlaying(false);
    onPause?.();
  };

  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const error = new Error(`Video load failed: ${e.currentTarget.error?.message || 'Unknown error'}`);
    console.error('[NeverBlackVideo] Video error', { src: videoUrl, error });
    onError?.(error);
  };

  // Show poster until video is playing
  const showPoster = !isPlaying && (posterLoaded || !posterError);
  const showPlaceholder = !showPoster && !videoReady;

  return (
    <div className={`relative ${className}`} style={{ aspectRatio: '16/9' }}>
      {/* Video element */}
      <video
        ref={setVideoRef}
        className="w-full h-full object-cover"
        src={videoUrl || undefined}
        poster={posterUrl || undefined}
        muted={muted}
        playsInline={playsInline}
        controls={controls}
        autoPlay={autoPlay}
        preload="metadata"
        onLoadedMetadata={handleVideoLoadedMetadata}
        onPlay={handleVideoPlay}
        onPause={handleVideoPause}
        onError={handleVideoError}
        style={{
          opacity: (showPoster || showPlaceholder) ? 0 : 1,
          transition: 'opacity 0.3s ease'
        }}
      >
        {children}
      </video>

      {/* Poster overlay */}
      {posterUrl && showPoster && (
        <div className="absolute inset-0">
          <Image
            src={posterUrl}
            alt="Video thumbnail"
            fill
            className="object-cover"
            onLoad={handlePosterLoad}
            onError={handlePosterError}
            priority
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        </div>
      )}

      {/* Fallback placeholder */}
      {showPlaceholder && (
        <div className="absolute inset-0">
          <VideoPlaceholder className="w-full h-full" />
        </div>
      )}

      {/* Loading indicator */}
      {!videoReady && !posterError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
      )}
    </div>
  );
}
