'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, MessageCircle, Share2, Heart, Bookmark, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

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

interface PostModalProps {
  isOpen: boolean;
  onClose: () => void;
  post: Post;
  videoElement?: HTMLVideoElement | null;
  isVideo?: boolean;
}

export default function PostModal({ 
  isOpen, 
  onClose, 
  post, 
  videoElement, 
  isVideo = false 
}: PostModalProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const commentsContainerRef = useRef<HTMLDivElement>(null);

  // Fetch comments when modal opens (with debouncing)
  useEffect(() => {
    if (isOpen && post.id) {
      // Add small delay to prevent blocking UI
      const timer = setTimeout(() => {
        fetchComments();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, post.id]);

  // Handle video element reuse (optimized)
  useEffect(() => {
    if (isOpen && isVideo && videoElement && videoContainerRef.current) {
      // Use requestAnimationFrame to avoid blocking UI
      requestAnimationFrame(() => {
        if (videoContainerRef.current && videoElement) {
          // Move video element to modal container
          videoContainerRef.current.appendChild(videoElement);
          
          // Restore video state from dataset
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
      });
    }
  }, [isOpen, isVideo, videoElement]);

  // Trigger video portal events for video transfer
  useEffect(() => {
    if (isOpen) {
      // Trigger video portal ready event to transfer video element
      const event = new CustomEvent('carrot-video-portal-ready', {
        detail: { postId: post.id }
      });
      window.dispatchEvent(event);
    } else {
      // Trigger video portal dismiss event to restore video element
      const event = new CustomEvent('carrot-video-portal-dismiss', {
        detail: { postId: post.id }
      });
      window.dispatchEvent(event);
    }
  }, [isOpen, post.id]);

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
      
      // Clean up video element if modal is closing (optimized)
      if (!isOpen && videoElement && videoContainerRef.current) {
        // Use requestAnimationFrame for smooth cleanup
        requestAnimationFrame(() => {
          if (videoContainerRef.current && videoContainerRef.current.contains(videoElement)) {
            videoContainerRef.current.removeChild(videoElement);
          }
        });
      }
    };
  }, [isOpen, onClose, videoElement]);

  // Focus trap
  useEffect(() => {
    if (isOpen && modalRef.current) {
      const focusableElements = modalRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

      const handleTabKey = (e: KeyboardEvent) => {
        if (e.key === 'Tab') {
          if (e.shiftKey) {
            if (document.activeElement === firstElement) {
              lastElement?.focus();
              e.preventDefault();
            }
          } else {
            if (document.activeElement === lastElement) {
              firstElement?.focus();
              e.preventDefault();
            }
          }
        }
      };

      document.addEventListener('keydown', handleTabKey);
      firstElement?.focus();

      return () => {
        document.removeEventListener('keydown', handleTabKey);
      };
    }
  }, [isOpen]);

  const fetchComments = async () => {
    setIsLoadingComments(true);
    try {
      // Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await fetch(`/api/comments?postId=${post.id}`, {
        signal: controller.signal,
        cache: 'no-cache', // Ensure fresh data
        headers: {
          'Accept': 'application/json',
        }
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        setComments(data.comments || []);
      } else {
        console.warn('Failed to fetch comments:', response.status);
        setComments([]); // Set empty array on error
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Failed to fetch comments:', error);
      }
      setComments([]); // Set empty array on error
    } finally {
      setIsLoadingComments(false);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || isSubmittingComment) return;

    setIsSubmittingComment(true);
    try {
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          postId: post.id,
          content: newComment.trim(),
        }),
      });

      if (response.ok) {
        const newCommentData = await response.json();
        setComments(prev => [newCommentData, ...prev]);
        setNewComment('');
      }
    } catch (error) {
      console.error('Failed to submit comment:', error);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleLike = async () => {
    // Implement like functionality
    console.log('Like post:', post.id);
  };

  const handleBookmark = async () => {
    // Implement bookmark functionality
    console.log('Bookmark post:', post.id);
  };

  const handleShare = async () => {
    // Implement share functionality
    console.log('Share post:', post.id);
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
    return `${Math.floor(diffInSeconds / 86400)}d`;
  };

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Modal */}
      <div
        ref={modalRef}
        className="relative w-full h-full max-w-7xl max-h-[95vh] mx-4 my-4 bg-white rounded-2xl shadow-2xl overflow-hidden"
        role="document"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={post.author.avatar} alt={post.author.name} />
              <AvatarFallback className="text-sm font-medium">
                {post.author.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 id="modal-title" className="text-lg font-semibold text-gray-900 leading-tight">
                {post.author.name}
              </h1>
              <p className="text-sm text-gray-500 leading-tight">
                {formatTimeAgo(post.createdAt)}
              </p>
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-10 w-10 p-0 rounded-full hover:bg-gray-100"
            aria-label="Close modal"
          >
            <X size={18} />
          </Button>
        </div>

        {/* Content */}
        <div className="flex h-[calc(100vh-120px)]">
          {/* Main Content Area */}
          <div className="flex-1 flex flex-col">
            {/* Video/Media Area */}
            <div 
              ref={videoContainerRef}
              className="flex-1 bg-gray-900 flex items-center justify-center relative"
            >
              {/* Video portal mount point */}
              <div 
                data-video-portal-for={post.id}
                className="w-full h-full flex items-center justify-center"
              >
                {isVideo && videoElement ? (
                  <div className="w-full h-full">
                    {/* Video element will be moved here and styled */}
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
                  <div className="text-center text-gray-400">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-800 flex items-center justify-center">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium">No media content</p>
                    <p className="text-xs text-gray-500 mt-1">This post doesn't contain any media</p>
                  </div>
                )}
              </div>
            </div>

            {/* Post Content */}
            {post.content && post.content !== 'Loading post...' && (
              <div className="px-6 py-4 border-t border-gray-100">
                <div className="prose prose-sm max-w-none">
                  <p className="text-gray-900 leading-relaxed whitespace-pre-wrap">
                    {post.content}
                  </p>
                </div>
              </div>
            )}

            {/* Action Bar */}
            <div className="px-6 py-4 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <button
                    onClick={handleLike}
                    className={`flex items-center gap-2 px-3 py-2 rounded-full transition-colors ${
                      post.isLiked 
                        ? 'text-red-500 bg-red-50 hover:bg-red-100' 
                        : 'text-gray-600 hover:text-red-500 hover:bg-red-50'
                    }`}
                  >
                    <Heart size={18} className={post.isLiked ? 'fill-current' : ''} />
                    <span className="text-sm font-medium">{post.likes}</span>
                  </button>
                  
                  <button className="flex items-center gap-2 px-3 py-2 rounded-full text-gray-600 hover:text-blue-500 hover:bg-blue-50 transition-colors">
                    <MessageCircle size={18} />
                    <span className="text-sm font-medium">{post.comments}</span>
                  </button>
                  
                  <button
                    onClick={handleShare}
                    className="flex items-center gap-2 px-3 py-2 rounded-full text-gray-600 hover:text-green-500 hover:bg-green-50 transition-colors"
                  >
                    <Share2 size={18} />
                    <span className="text-sm font-medium">{post.shares}</span>
                  </button>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleBookmark}
                    className={`p-2 rounded-full transition-colors ${
                      post.isBookmarked 
                        ? 'text-blue-500 bg-blue-50 hover:bg-blue-100' 
                        : 'text-gray-600 hover:text-blue-500 hover:bg-blue-50'
                    }`}
                  >
                    <Bookmark size={18} className={post.isBookmarked ? 'fill-current' : ''} />
                  </button>
                  <button className="p-2 rounded-full text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors">
                    <MoreHorizontal size={18} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Comments Sidebar (Desktop) */}
          <div className="hidden lg:block w-80 border-l border-gray-100 flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Comments</h2>
              <p className="text-sm text-gray-500 mt-1">Join the conversation</p>
            </div>
            
            <div 
              ref={commentsContainerRef}
              className="flex-1 overflow-y-auto px-6 py-4 space-y-4"
            >
              {isLoadingComments ? (
                <div className="flex items-center justify-center py-12">
                  <div className="flex items-center gap-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-200 border-t-gray-600"></div>
                    <span className="text-sm text-gray-500 font-medium">Loading comments...</span>
                  </div>
                </div>
              ) : comments.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                    <MessageCircle className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-sm font-medium text-gray-900 mb-1">No comments yet</h3>
                  <p className="text-sm text-gray-500">Be the first to share your thoughts!</p>
                </div>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="flex gap-3">
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarImage src={comment.author.avatar} alt={comment.author.name} />
                      <AvatarFallback>{comment.author.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm text-gray-900">
                          {comment.author.name}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatTimeAgo(comment.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">
                        {comment.content}
                      </p>
                      <div className="flex items-center gap-3 mt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`h-6 px-2 text-xs ${comment.isLiked ? 'text-red-500' : 'text-gray-500'}`}
                        >
                          <Heart size={12} className={comment.isLiked ? 'fill-current' : ''} />
                          <span className="ml-1">{comment.likes}</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs text-gray-500"
                        >
                          Reply
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Comment Input */}
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
              <form onSubmit={handleSubmitComment} className="flex gap-3">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  disabled={isSubmittingComment}
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={!newComment.trim() || isSubmittingComment}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl"
                >
                  {isSubmittingComment ? 'Posting...' : 'Post'}
                </Button>
              </form>
            </div>
          </div>
        </div>

        {/* Mobile Comments Section */}
        <div className="lg:hidden border-t border-gray-200">
          <div className="p-4">
            <h3 className="font-semibold text-gray-900 mb-4">Comments</h3>
            
            <div className="max-h-64 overflow-y-auto space-y-4 mb-4">
              {isLoadingComments ? (
                <div className="text-center text-gray-500 py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-500 mx-auto"></div>
                  <p className="mt-2 text-sm">Loading comments...</p>
                </div>
              ) : comments.length === 0 ? (
                <div className="text-center text-gray-500 py-4">
                  <MessageCircle size={24} className="mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">No comments yet</p>
                </div>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="flex gap-3">
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarImage src={comment.author.avatar} alt={comment.author.name} />
                      <AvatarFallback>{comment.author.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm text-gray-900">
                          {comment.author.name}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatTimeAgo(comment.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">
                        {comment.content}
                      </p>
                      <div className="flex items-center gap-3 mt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`h-6 px-2 text-xs ${comment.isLiked ? 'text-red-500' : 'text-gray-500'}`}
                        >
                          <Heart size={12} className={comment.isLiked ? 'fill-current' : ''} />
                          <span className="ml-1">{comment.likes}</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs text-gray-500"
                        >
                          Reply
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Mobile Comment Input */}
            <form onSubmit={handleSubmitComment} className="flex gap-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isSubmittingComment}
              />
              <Button
                type="submit"
                size="sm"
                disabled={!newComment.trim() || isSubmittingComment}
                className="px-4"
              >
                {isSubmittingComment ? 'Posting...' : 'Post'}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}