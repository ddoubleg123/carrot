"use client";
import React from "react";
import { useSearchParams } from "next/navigation";
import PostModal from "./PostModal";
import { useModalRoute } from "../../hooks/useModalRoute";

export default function PostModalController() {
  const params = useSearchParams();
  const { closePostModal } = useModalRoute();
  const show = params?.get('modal') === '1';
  const postId = params?.get('post') || '';

  if (!show || !postId) return null;
  
  // Try to find the video element for this post
  const videoElement = document.querySelector(`[data-post-video-id="${postId}"]`) as HTMLVideoElement | null;
  const isVideo = !!videoElement;
  
  // Create a mock post object for the new PostModal interface
  const mockPost = {
    id: postId,
    content: '', // Don't show "Loading post..." - let the modal handle loading states
    author: {
      id: 'temp',
      name: 'Loading...',
      avatar: undefined,
    },
    mediaUrl: undefined,
    mediaType: isVideo ? 'video' as const : undefined,
    likes: 0,
    comments: 0,
    shares: 0,
    isLiked: false,
    isBookmarked: false,
    createdAt: new Date().toISOString(),
  };

  return (
    <PostModal 
      isOpen={show} 
      onClose={closePostModal} 
      post={mockPost}
      videoElement={videoElement}
      isVideo={isVideo}
    />
  );
}
