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

  // Fetch comments when modal opens
  useEffect(() => {
    if (isOpen && post.id) {
      fetchComments();
    }
  }, [isOpen, post.id]);

  // Handle video element reuse
  useEffect(() => {
    if (isOpen && isVideo && videoElement && videoContainerRef.current) {
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
      
      // Clean up video element if modal is closing
      if (!isOpen && videoElement && videoContainerRef.current) {
        // Video element will be restored by usePostModal hook
        // Just ensure it's removed from modal container
        if (videoContainerRef.current.contains(videoElement)) {
          videoContainerRef.current.removeChild(videoElement);
        }
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
      const response = await fetch(`/api/comments?postId=${post.id}`);
      if (response.ok) {
        const data = await response.json();
        setComments(data.comments || []);
      }
    } catch (error) {
      console.error('Failed to fetch comments:', error);
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
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={post.author.avatar} alt={post.author.name} />
              <AvatarFallback>{post.author.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
              <h2 id="modal-title" className="font-semibold text-gray-900">
                {post.author.name}
              </h2>
              <p className="text-sm text-gray-500">{formatTimeAgo(post.createdAt)}</p>
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
            aria-label="Close modal"
          >
            <X size={20} />
          </Button>
        </div>

        {/* Content */}
        <div className="flex h-[calc(100vh-120px)]">
          {/* Main Content Area */}
          <div className="flex-1 flex flex-col">
            {/* Video/Media Area */}
            <div 
              ref={videoContainerRef}
              className="flex-1 bg-black flex items-center justify-center relative"
            >
              {isVideo && videoElement ? (
                <div className="w-full h-full">
                  {/* Video element will be moved here */}
                </div>
              ) : post.mediaUrl ? (
                <img
                  src={post.mediaUrl}
                  alt="Post content"
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <div className="text-center text-gray-500">
                  <p>No media content</p>
                </div>
              )}
            </div>

            {/* Post Content */}
            <div className="p-4 border-t border-gray-200">
              <p className="text-gray-900 whitespace-pre-wrap">{post.content}</p>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between p-4 border-t border-gray-200">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLike}
                  className={`h-8 w-8 p-0 ${post.isLiked ? 'text-red-500' : 'text-gray-500'}`}
                >
                  <Heart size={20} className={post.isLiked ? 'fill-current' : ''} />
                </Button>
                <span className="text-sm text-gray-500">{post.likes}</span>
                
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-gray-500"
                >
                  <MessageCircle size={20} />
                </Button>
                <span className="text-sm text-gray-500">{post.comments}</span>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleShare}
                  className="h-8 w-8 p-0 text-gray-500"
                >
                  <Share2 size={20} />
                </Button>
                <span className="text-sm text-gray-500">{post.shares}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBookmark}
                  className={`h-8 w-8 p-0 ${post.isBookmarked ? 'text-blue-500' : 'text-gray-500'}`}
                >
                  <Bookmark size={20} className={post.isBookmarked ? 'fill-current' : ''} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-gray-500"
                >
                  <MoreHorizontal size={20} />
                </Button>
              </div>
            </div>
          </div>

          {/* Comments Sidebar (Desktop) */}
          <div className="hidden lg:block w-80 border-l border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Comments</h3>
            </div>
            
            <div 
              ref={commentsContainerRef}
              className="flex-1 overflow-y-auto p-4 space-y-4"
            >
              {isLoadingComments ? (
                <div className="text-center text-gray-500 py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-500 mx-auto"></div>
                  <p className="mt-2">Loading comments...</p>
                </div>
              ) : comments.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <MessageCircle size={32} className="mx-auto mb-2 text-gray-300" />
                  <p>No comments yet</p>
                  <p className="text-sm">Be the first to comment!</p>
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
            <div className="p-4 border-t border-gray-200">
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