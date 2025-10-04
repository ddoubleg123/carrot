'use client';

import { useState, useRef, useCallback } from 'react';

interface Post {
  id: string;
  content: string;
  author: {
    id: string;
    name: string;
    avatar?: string;
  };
  mediaUrl?: string;
  mediaType?: 'video' | 'image';
  likes: number;
  comments: number;
  shares: number;
  isLiked: boolean;
  isBookmarked: boolean;
  createdAt: string;
}

interface UsePostModalReturn {
  isOpen: boolean;
  currentPost: Post | null;
  videoElement: HTMLVideoElement | null;
  isVideo: boolean;
  openModal: (post: Post, videoElement?: HTMLVideoElement | null) => void;
  closeModal: () => void;
  setVideoElement: (element: HTMLVideoElement | null) => void;
}

export function usePostModal(): UsePostModalReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [currentPost, setCurrentPost] = useState<Post | null>(null);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const [isVideo, setIsVideo] = useState(false);
  const originalParentRef = useRef<HTMLElement | null>(null);
  const originalNextSiblingRef = useRef<Node | null>(null);

  const openModal = useCallback((post: Post, videoEl?: HTMLVideoElement | null) => {
    setCurrentPost(post);
    setIsVideo(post.mediaType === 'video' && !!videoEl);
    
    if (videoEl && post.mediaType === 'video') {
      // Store original position BEFORE moving
      originalParentRef.current = videoEl.parentElement;
      originalNextSiblingRef.current = videoEl.nextSibling;
      
      // Store video state
      const currentTime = videoEl.currentTime;
      const isPaused = videoEl.paused;
      const volume = videoEl.volume;
      const playbackRate = videoEl.playbackRate;
      
      // Preserve video state in dataset
      videoEl.dataset.originalTime = currentTime.toString();
      videoEl.dataset.originalPaused = isPaused.toString();
      videoEl.dataset.originalVolume = volume.toString();
      videoEl.dataset.originalPlaybackRate = playbackRate.toString();
      
      // Store video element reference
      setVideoElement(videoEl);
    } else {
      setVideoElement(null);
    }
    
    setIsOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    if (videoElement && originalParentRef.current) {
      // Restore video element to original position
      if (originalNextSiblingRef.current) {
        originalParentRef.current.insertBefore(videoElement, originalNextSiblingRef.current);
      } else {
        originalParentRef.current.appendChild(videoElement);
      }
      
      // Restore video state
      const originalTime = parseFloat(videoElement.dataset.originalTime || '0');
      const originalPaused = videoElement.dataset.originalPaused === 'true';
      const originalVolume = parseFloat(videoElement.dataset.originalVolume || '1');
      const originalPlaybackRate = parseFloat(videoElement.dataset.originalPlaybackRate || '1');
      
      videoElement.currentTime = originalTime;
      videoElement.volume = originalVolume;
      videoElement.playbackRate = originalPlaybackRate;
      
      if (!originalPaused) {
        videoElement.play().catch(console.error);
      }
      
      // Clean up dataset
      delete videoElement.dataset.originalTime;
      delete videoElement.dataset.originalPaused;
      delete videoElement.dataset.originalVolume;
      delete videoElement.dataset.originalPlaybackRate;
    }
    
    setIsOpen(false);
    setCurrentPost(null);
    setVideoElement(null);
    setIsVideo(false);
    originalParentRef.current = null;
    originalNextSiblingRef.current = null;
  }, [videoElement]);

  return {
    isOpen,
    currentPost,
    videoElement,
    isVideo,
    openModal,
    closeModal,
    setVideoElement,
  };
}
