'use client';

import React, { useRef } from 'react';
import { MessageCircle, Share2, Heart, Bookmark, MoreHorizontal, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import ReusableVideoPlayer, { ReusableVideoPlayerRef } from '@/components/video/ReusableVideoPlayer';
import PostModal from '@/components/post-modal/PostModal';
import { usePostModal } from '@/hooks/usePostModal';

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

interface PostCardWithModalProps {
  post: Post;
}

export default function PostCardWithModal({ post }: PostCardWithModalProps) {
  const videoPlayerRef = useRef<ReusableVideoPlayerRef>(null);
  const { isOpen, currentPost, videoElement, isVideo, openModal, closeModal } = usePostModal();

  const handleFullscreenClick = () => {
    const videoEl = videoPlayerRef.current?.getVideoElement() || null;
    openModal(post, videoEl);
  };

  const handleCommentsClick = () => {
    const videoEl = post.mediaType === 'video' ? videoPlayerRef.current?.getVideoElement() || null : null;
    openModal(post, videoEl);
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

  return (
    <>
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 p-4">
          <Avatar className="h-10 w-10">
            <AvatarImage src={post.author.avatar} alt={post.author.name} />
            <AvatarFallback>{post.author.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">{post.author.name}</h3>
            <p className="text-sm text-gray-500">{formatTimeAgo(post.createdAt)}</p>
          </div>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <MoreHorizontal size={16} />
          </Button>
        </div>

        {/* Content */}
        <div className="px-4 pb-3">
          <p className="text-gray-900 whitespace-pre-wrap">{post.content}</p>
        </div>

        {/* Media */}
        {post.mediaUrl && (
          <div className="relative">
            {post.mediaType === 'video' ? (
              <ReusableVideoPlayer
                ref={videoPlayerRef}
                src={post.mediaUrl}
                className="w-full aspect-video"
                controls={true}
                autoPlay={false}
                muted={true}
                onFullscreen={handleFullscreenClick}
              />
            ) : (
              <img
                src={post.mediaUrl}
                alt="Post content"
                className="w-full h-auto object-cover"
              />
            )}
          </div>
        )}

        {/* Action Bar */}
        <div className="flex items-center justify-between p-4 border-t border-gray-100">
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
              onClick={handleCommentsClick}
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
            {post.mediaType === 'video' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleFullscreenClick}
                className="h-8 w-8 p-0 text-gray-500"
                title="Fullscreen"
              >
                <Maximize2 size={20} />
              </Button>
            )}
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBookmark}
              className={`h-8 w-8 p-0 ${post.isBookmarked ? 'text-blue-500' : 'text-gray-500'}`}
            >
              <Bookmark size={20} className={post.isBookmarked ? 'fill-current' : ''} />
            </Button>
          </div>
        </div>
      </div>

      {/* Post Modal */}
      {currentPost && (
        <PostModal
          isOpen={isOpen}
          onClose={closeModal}
          post={currentPost}
          videoElement={videoElement}
          isVideo={isVideo}
        />
      )}
    </>
  );
}
