"use client";
import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import UnifiedContentModal from "../modal/UnifiedContentModal";
import { useModalRoute } from "../../hooks/useModalRoute";

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

export default function UnifiedPostModalController() {
  const params = useSearchParams();
  const { closePostModal } = useModalRoute();
  const show = params?.get('modal') === '1';
  const postId = params?.get('post') || '';
  
  const [post, setPost] = useState<Post | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch post data when modal opens
  useEffect(() => {
    if (show && postId) {
      setIsLoading(true);
      setError(null);
      
      // Try to find the post data from the DOM first (faster)
      const postElement = document.querySelector(`[data-post-id="${postId}"]`);
      if (postElement) {
        // Extract post data from the DOM element
        const content = postElement.querySelector('[data-post-content]')?.textContent || '';
        const authorName = postElement.querySelector('[data-post-author]')?.textContent || 'Unknown';
        const createdAt = postElement.querySelector('[data-post-date]')?.getAttribute('datetime') || new Date().toISOString();
        
        const mockPost: Post = {
          id: postId,
          content,
          author: {
            id: 'temp',
            name: authorName,
            avatar: undefined,
          },
          mediaUrl: undefined,
          mediaType: undefined,
          likes: 0,
          comments: 0,
          shares: 0,
          isLiked: false,
          isBookmarked: false,
          createdAt,
        };
        
        setPost(mockPost);
        setIsLoading(false);
        return;
      }
      
      // Fallback: Create minimal post data
      const fallbackPost: Post = {
        id: postId,
        content: 'Loading post content...',
        author: {
          id: 'temp',
          name: 'Loading...',
          avatar: undefined,
        },
        mediaUrl: undefined,
        mediaType: undefined,
        likes: 0,
        comments: 0,
        shares: 0,
        isLiked: false,
        isBookmarked: false,
        createdAt: new Date().toISOString(),
      };
      
      setPost(fallbackPost);
      setIsLoading(false);
    }
  }, [show, postId]);

  if (!show || !postId) return null;
  
  // Try to find the video element for this post
  const videoElement = document.querySelector(`[data-post-video-id="${postId}"]`) as HTMLVideoElement | null;
  const isVideo = !!videoElement;

  return (
    <UnifiedContentModal
      item={post}
      isOpen={show}
      onClose={closePostModal}
      source="home"
      videoElement={videoElement}
    />
  );
}
