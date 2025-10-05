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
  
  // Create a mock post object for the new PostModal interface
  const mockPost = {
    id: postId,
    content: 'Loading post...',
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

  return (
    <PostModal 
      isOpen={show} 
      onClose={closePostModal} 
      post={mockPost}
      videoElement={null}
      isVideo={false}
    />
  );
}
