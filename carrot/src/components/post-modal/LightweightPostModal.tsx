'use client';

import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { X, MessageCircle, Share2, Heart, Bookmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface Comment {
  id: string;
  content: string;
  author: {
    id: string;
    name: string;
    avatar?: string;
  };
  createdAt: string;
  likes: number;
  isLiked: boolean;
}

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

interface LightweightPostModalProps {
  isOpen: boolean;
  onClose: () => void;
  post: Post;
  videoElement?: HTMLVideoElement | null;
  isVideo?: boolean;
}

// Lazy-loaded comments component
const CommentsPanel = React.lazy(() => import('./CommentsPanel'));

export default function LightweightPostModal({ 
  isOpen, 
  onClose, 
  post, 
  videoElement, 
  isVideo = false 
}: LightweightPostModalProps) {
  const [showComments, setShowComments] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);

  // Store original parent for restoration
  const originalParentRef = useRef<HTMLElement | null>(null);

  // Optimized video element handling - CRITICAL FIX: Save state before moving
  useEffect(() => {
    if (isOpen && isVideo && videoElement && videoContainerRef.current) {
      // Use requestIdleCallback for non-blocking DOM manipulation
      const handleVideoMove = () => {
        if (videoContainerRef.current && videoElement) {
          // CRITICAL FIX: Save original parent before moving
          if (!originalParentRef.current && videoElement.parentElement) {
            originalParentRef.current = videoElement.parentElement;
            console.log('[LightweightPostModal] Saved original parent:', {
              postId: post.id,
              parentTag: originalParentRef.current.tagName,
              parentClass: originalParentRef.current.className
            });
          }
          
          // CRITICAL FIX: Save video state BEFORE moving the element
          const currentTime = videoElement.currentTime;
          const isPaused = videoElement.paused;
          const volume = videoElement.volume;
          const playbackRate = videoElement.playbackRate;
          const wasMuted = videoElement.muted;
          
          console.log('[LightweightPostModal] Saving video state before move:', {
            postId: post.id,
            currentTime,
            isPaused,
            volume,
            playbackRate,
            wasMuted
          });
          
          // Store state in dataset for restoration
          videoElement.dataset.originalTime = String(currentTime);
          videoElement.dataset.originalPaused = String(isPaused);
          videoElement.dataset.originalVolume = String(volume);
          videoElement.dataset.originalPlaybackRate = String(playbackRate);
          videoElement.dataset.originalMuted = String(wasMuted);
          
          // Move the video element to modal
          videoContainerRef.current.appendChild(videoElement);
          
          // Restore video state immediately after move
          videoElement.currentTime = currentTime;
          videoElement.volume = volume;
          videoElement.playbackRate = playbackRate;
          videoElement.muted = wasMuted;
          
          console.log('[LightweightPostModal] Video moved to modal, state restored:', {
            postId: post.id,
            currentTime: videoElement.currentTime,
            isPaused: videoElement.paused
          });
          
          // Resume playback if it wasn't paused
          if (!isPaused) {
            // Wait for video to be ready before playing
            if (videoElement.readyState >= 2) {
              videoElement.play().catch(e => {
                console.warn('[LightweightPostModal] Play failed after move:', e);
              });
            } else {
              const playWhenReady = () => {
                videoElement.play().catch(e => {
                  console.warn('[LightweightPostModal] Play failed after canplay:', e);
                });
                videoElement.removeEventListener('canplay', playWhenReady);
              };
              videoElement.addEventListener('canplay', playWhenReady, { once: true });
            }
          }
        }
      };

      if ('requestIdleCallback' in window) {
        requestIdleCallback(handleVideoMove);
      } else {
        requestAnimationFrame(handleVideoMove);
      }
    }
  }, [isOpen, isVideo, videoElement, post.id]);

  // Handle ESC key and cleanup
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscKey);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscKey);
      document.body.style.overflow = 'unset';
      
      // CRITICAL FIX: Restore video element to original parent when closing
      if (!isOpen && videoElement) {
        const handleCleanup = () => {
          // Save current state before restoring
          const currentTime = videoElement.currentTime;
          const isPaused = videoElement.paused;
          const volume = videoElement.volume;
          const playbackRate = videoElement.playbackRate;
          const wasMuted = videoElement.muted;
          
          console.log('[LightweightPostModal] Restoring video to original parent:', {
            postId: post.id,
            currentTime,
            isPaused,
            hasOriginalParent: !!originalParentRef.current
          });
          
          // Remove from modal container
          if (videoContainerRef.current && videoContainerRef.current.contains(videoElement)) {
            videoContainerRef.current.removeChild(videoElement);
          }
          
          // Restore to original parent if we have it
          if (originalParentRef.current && !originalParentRef.current.contains(videoElement)) {
            originalParentRef.current.appendChild(videoElement);
            
            // Restore video state after moving back
            videoElement.currentTime = currentTime;
            videoElement.volume = volume;
            videoElement.playbackRate = playbackRate;
            videoElement.muted = wasMuted;
            
            console.log('[LightweightPostModal] Video restored to feed, state preserved:', {
              postId: post.id,
              currentTime: videoElement.currentTime,
              isPaused: videoElement.paused
            });
            
            // Resume playback if it wasn't paused
            if (!isPaused && videoElement.readyState >= 2) {
              videoElement.play().catch(e => {
                console.warn('[LightweightPostModal] Play failed after restore:', e);
              });
            }
          }
          
          // Clear the original parent ref for next modal open
          originalParentRef.current = null;
        };

        if ('requestIdleCallback' in window) {
          requestIdleCallback(handleCleanup);
        } else {
          requestAnimationFrame(handleCleanup);
        }
      }
    };
  }, [isOpen, onClose, videoElement, post.id]);

  // Optimized close handler
  const handleClose = useCallback(() => {
    setShowComments(false);
    onClose();
  }, [onClose]);

  // Optimized comments toggle
  const toggleComments = useCallback(() => {
    setShowComments(prev => !prev);
  }, []);

  if (!isOpen) return null;

  const modalContent = (
    <div
      ref={modalRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        className="relative w-full h-full max-w-7xl mx-auto bg-white rounded-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-white">
          <div className="flex items-center space-x-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={post.author.avatar} alt={post.author.name} />
              <AvatarFallback>{post.author.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold text-sm">{post.author.name}</p>
              <p className="text-xs text-gray-500">
                {new Date(post.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="h-8 w-8 p-0 rounded-full hover:bg-gray-100"
            aria-label="Close modal"
          >
            <X size={16} />
          </Button>
        </div>

        {/* Content */}
        <div className="flex h-[calc(100vh-80px)]">
          {/* Main Content Area */}
          <div className="flex-1 flex flex-col">
            {/* Video/Media Area */}
            <div 
              ref={videoContainerRef}
              className="flex-1 bg-gray-900 flex items-center justify-center relative"
            >
              {isVideo && videoElement ? (
                <div className="w-full h-full">
                  <style jsx>{`
                    video {
                      width: 100% !important;
                      height: 100% !important;
                      object-fit: contain !important;
                      border-radius: 0 !important;
                    }
                  `}</style>
                </div>
              ) : post.mediaUrl ? (
                <img
                  src={post.mediaUrl}
                  alt="Post content"
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <div className="text-white text-center">
                  <p className="text-lg mb-2">{post.content}</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="p-4 border-t bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {}}
                    className="flex items-center space-x-2"
                  >
                    <Heart size={16} />
                    <span>{post.likes}</span>
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleComments}
                    className="flex items-center space-x-2"
                  >
                    <MessageCircle size={16} />
                    <span>{post.comments}</span>
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {}}
                    className="flex items-center space-x-2"
                  >
                    <Share2 size={16} />
                    <span>{post.shares}</span>
                  </Button>
                </div>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {}}
                >
                  <Bookmark size={16} />
                </Button>
              </div>
            </div>
          </div>

          {/* Comments Panel - Lazy Loaded */}
          {showComments && (
            <div className="w-80 border-l bg-white">
              <Suspense fallback={
                <div className="p-4 text-center text-gray-500">
                  Loading comments...
                </div>
              }>
                <CommentsPanel postId={post.id} onClose={() => setShowComments(false)} />
              </Suspense>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
