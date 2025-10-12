'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVideoContext } from '@/context/VideoContext';

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
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  const {
    videoElement: globalVideoElement,
    currentTime: globalCurrentTime,
    duration: globalDuration,
    isPlaying: globalIsPlaying,
    isMuted: globalIsMuted,
    volume: globalVolume,
    setVideoElement,
    setCurrentTime,
    setDuration,
    setIsPlaying,
    setIsMuted,
    setVolume,
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
      setCurrentTime(video.currentTime);
      setCurrentTime(video.currentTime); // Update global context
    };

    const handleDurationChange = () => {
      setDuration(video.duration);
      setDuration(video.duration); // Update global context
    };

    const handlePlay = () => {
      setIsPlaying(true);
      setIsPlaying(true); // Update global context
    };

    const handlePause = () => {
      setIsPlaying(false);
      setIsPlaying(false); // Update global context
    };

    const handleVolumeChange = () => {
      setVolume(video.volume);
      setIsMuted(video.muted);
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
  }, [setCurrentTime, setDuration, setIsPlaying, setVolume, setIsMuted]);

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
      setCurrentTime(video.currentTime);
      setDuration(video.duration);
      setIsPlaying(!video.paused);
      setIsMuted(video.muted);
      setVolume(video.volume);
      
      // Transfer state back to feed
      transferFromModal(postId);
    }
    
    if (onClose) {
      onClose();
    }
  };

  const videoVariants = {
    hidden: { 
      opacity: 0, 
      scale: 0.8,
      y: isModal ? 50 : 0 
    },
    visible: { 
      opacity: 1, 
      scale: 1,
      y: 0,
      transition: {
        duration: 0.3,
        ease: "easeOut"
      }
    },
    exit: { 
      opacity: 0, 
      scale: 0.8,
      y: isModal ? -50 : 0,
      transition: {
        duration: 0.2,
        ease: "easeIn"
      }
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        variants={videoVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className={`relative ${className}`}
      >
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
      </motion.div>
    </AnimatePresence>
  );
}
