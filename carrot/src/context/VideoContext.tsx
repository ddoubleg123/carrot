import React, { createContext, useContext, useMemo, useState, useCallback, useRef } from 'react';

export type VideoState = {
  playingVideoId: string | null;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  isMuted: boolean;
  volume: number;
  videoElement: HTMLVideoElement | null;
  setPlayingVideoId: (id: string | null) => void;
  setCurrentTime: (t: number) => void;
  setDuration: (d: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setIsMuted: (muted: boolean) => void;
  setVolume: (volume: number) => void;
  setVideoElement: (element: HTMLVideoElement | null) => void;
  // Modal transition methods
  transferToModal: (postId: string) => void;
  transferFromModal: (postId: string) => void;
  isModalTransitioning: boolean;
};

const defaultState: VideoState = {
  playingVideoId: null,
  currentTime: 0,
  duration: 0,
  isPlaying: false,
  isMuted: true,
  volume: 1,
  videoElement: null,
  setPlayingVideoId: () => {},
  setCurrentTime: () => {},
  setDuration: () => {},
  setIsPlaying: () => {},
  setIsMuted: () => {},
  setVolume: () => {},
  setVideoElement: () => {},
  transferToModal: () => {},
  transferFromModal: () => {},
  isModalTransitioning: false,
};

const Ctx = createContext<VideoState>(defaultState);

export function VideoProvider({ children }: { children: React.ReactNode }) {
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [volume, setVolume] = useState<number>(1);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const [isModalTransitioning, setIsModalTransitioning] = useState<boolean>(false);
  
  const videoStateRef = useRef({
    currentTime: 0,
    duration: 0,
    isPlaying: false,
    isMuted: true,
    volume: 1,
  });

  const transferToModal = useCallback((postId: string) => {
    console.log('[VideoContext] Transferring video to modal', { postId, currentTime, isPlaying });
    setIsModalTransitioning(true);
    
    // Capture current video state
    if (videoElement) {
      videoStateRef.current = {
        currentTime: videoElement.currentTime,
        duration: videoElement.duration,
        isPlaying: !videoElement.paused,
        isMuted: videoElement.muted,
        volume: videoElement.volume,
      };
      
      setCurrentTime(videoElement.currentTime);
      setDuration(videoElement.duration);
      setIsPlaying(!videoElement.paused);
      setIsMuted(videoElement.muted);
      setVolume(videoElement.volume);
    }
    
    // Pause the current video but don't reset its state
    if (videoElement && !videoElement.paused) {
      videoElement.pause();
    }
    
    // The modal will restore this state when it mounts
    setTimeout(() => setIsModalTransitioning(false), 300);
  }, [videoElement, currentTime, isPlaying]);

  const transferFromModal = useCallback((postId: string) => {
    console.log('[VideoContext] Transferring video from modal', { postId, currentTime, isPlaying });
    setIsModalTransitioning(true);
    
    // Restore the video state when returning from modal
    if (videoElement) {
      videoElement.currentTime = videoStateRef.current.currentTime;
      videoElement.volume = videoStateRef.current.volume;
      videoElement.muted = videoStateRef.current.isMuted;
      
      if (videoStateRef.current.isPlaying) {
        videoElement.play().catch(e => console.warn('[VideoContext] Failed to resume playback:', e));
      }
    }
    
    setTimeout(() => setIsModalTransitioning(false), 300);
  }, [videoElement, currentTime, isPlaying]);

  const value = useMemo<VideoState>(() => ({
    playingVideoId,
    currentTime,
    duration,
    isPlaying,
    isMuted,
    volume,
    videoElement,
    setPlayingVideoId,
    setCurrentTime,
    setDuration,
    setIsPlaying,
    setIsMuted,
    setVolume,
    setVideoElement,
    transferToModal,
    transferFromModal,
    isModalTransitioning,
  }), [
    playingVideoId, 
    currentTime, 
    duration, 
    isPlaying, 
    isMuted, 
    volume, 
    videoElement,
    transferToModal,
    transferFromModal,
    isModalTransitioning,
  ]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useVideoContext() {
  return useContext(Ctx);
}
