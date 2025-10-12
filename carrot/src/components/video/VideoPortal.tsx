'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useVideoContext } from '@/context/VideoContext';

// Note: framer-motion animations will be added when the package is installed
// For now, using plain divs without animation

interface VideoPortalProps {
  postId: string;
  src: string;
  poster?: string;
  className?: string;
  isModal?: boolean;
  onClose?: () => void;
}

export default function VideoPortal({ 
  postId, 
  src, 
  poster, 
  className = '', 
  isModal = false,
  onClose 
}: VideoPortalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  
  const {
    videoElement: globalVideoElement,
    currentTime: globalCurrentTime,
    duration: globalDuration,
    isPlaying: globalIsPlaying,
    isMuted: globalIsMuted,
    volume: globalVolume,
    setVideoElement,
    setCurrentTime: setGlobalCurrentTime,
    setDuration: setGlobalDuration,
    setIsPlaying: setGlobalIsPlaying,
    setIsMuted: setGlobalIsMuted,
    setVolume: setGlobalVolume,
    isModalTransitioning,
    transferFromModal,
  } = useVideoContext();

  // Restore video state when transitioning from modal
  useEffect(() => {
    if (isModal && globalVideoElement && globalCurrentTime > 0) {
      console.log('[VideoPortal] Restoring video state in modal', {
        postId,
        currentTime: globalCurrentTime,
        duration: globalDuration,
        isPlaying: globalIsPlaying,
        isMuted: globalIsMuted,
        volume: globalVolume,
      });
      
      if (videoRef.current) {
        videoRef.current.currentTime = globalCurrentTime;
        videoRef.current.volume = globalVolume;
        videoRef.current.muted = globalIsMuted;
        
        if (globalIsPlaying) {
          videoRef.current.play().catch(e => 
            console.warn('[VideoPortal] Failed to resume playback in modal:', e)
          );
        }
      }
    }
  }, [isModal, globalVideoElement, globalCurrentTime, globalDuration, globalIsPlaying, globalIsMuted, globalVolume, postId]);

  // Sync video state with global context
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setGlobalCurrentTime(video.currentTime);
    };

    const handleDurationChange = () => {
      setGlobalDuration(video.duration);
    };

    const handlePlay = () => {
      setGlobalIsPlaying(true);
    };

    const handlePause = () => {
      setGlobalIsPlaying(false);
    };

    const handleVolumeChange = () => {
      setGlobalVolume(video.volume);
      setGlobalIsMuted(video.muted);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('volumechange', handleVolumeChange);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('volumechange', handleVolumeChange);
    };
  }, [setGlobalCurrentTime, setGlobalDuration, setGlobalIsPlaying, setGlobalVolume, setGlobalIsMuted]);

  // Register with global video context
  useEffect(() => {
    if (videoRef.current && !isModal) {
      setVideoElement(videoRef.current);
    }
    
    return () => {
      if (!isModal) {
        setVideoElement(null);
      }
    };
  }, [isModal, setVideoElement]);

  // Handle modal close
  const handleClose = () => {
    if (isModal && videoRef.current) {
      // Capture current state before closing
      const video = videoRef.current;
      setGlobalCurrentTime(video.currentTime);
      setGlobalDuration(video.duration);
      setGlobalIsPlaying(!video.paused);
      setGlobalIsMuted(video.muted);
      setGlobalVolume(video.volume);
      
      // Transfer state back to feed
      transferFromModal(postId);
    }
    
    if (onClose) {
      onClose();
    }
  };

  return (
    <div className={`relative ${className}`}>
        {isModal && (
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 z-10 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70 transition-colors"
            aria-label="Close video"
          >
            ×
          </button>
        )}
        
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          controls
          className="w-full h-full object-contain bg-black rounded-lg"
          onLoadedData={() => setIsLoaded(true)}
          onLoadStart={() => setIsLoaded(false)}
          preload="metadata"
          playsInline
          crossOrigin="anonymous"
        />
        
        {!isLoaded && (
          <div className="absolute inset-0 bg-gray-100 flex items-center justify-center rounded-lg">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400 mx-auto mb-2"></div>
              <div className="text-sm text-gray-500">Loading video...</div>
            </div>
          </div>
        )}
        
        {isModalTransitioning && (
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center rounded-lg">
            <div className="text-white text-sm">Transferring...</div>
          </div>
        )}
    </div>
  );
}
