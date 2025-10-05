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

  // Optimized video element handling
  useEffect(() => {
    if (isOpen && isVideo && videoElement && videoContainerRef.current) {
      // Use requestIdleCallback for non-blocking DOM manipulation
      const handleVideoMove = () => {
        if (videoContainerRef.current && videoElement) {
          videoContainerRef.current.appendChild(videoElement);
          
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
        }
      };

      if ('requestIdleCallback' in window) {
        requestIdleCallback(handleVideoMove);
      } else {
        requestAnimationFrame(handleVideoMove);
      }
    }
  }, [isOpen, isVideo, videoElement]);

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
      
      // Optimized cleanup
      if (!isOpen && videoElement && videoContainerRef.current) {
        const handleCleanup = () => {
          if (videoContainerRef.current && videoContainerRef.current.contains(videoElement)) {
            videoContainerRef.current.removeChild(videoElement);
          }
        };

        if ('requestIdleCallback' in window) {
          requestIdleCallback(handleCleanup);
        } else {
          requestAnimationFrame(handleCleanup);
        }
      }
    };
  }, [isOpen, onClose, videoElement]);

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
