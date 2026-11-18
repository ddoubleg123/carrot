'use client';

import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, MessageCircle, Share2, Heart, Bookmark } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import ShareSheet from '@/components/share/ShareSheet';
import { youtubeEmbedSrc, youtubeIdFromText } from '@/lib/youtube';
import { parseFeedPost } from '@/lib/feedPost';

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
    username?: string;
    avatar?: string;
  };
  mediaUrl?: string;
  thumbnailUrl?: string;
  videoUrl?: string;
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
  initialComments?: boolean;
}

// Lazy-loaded comments component
const CommentsPanel = React.lazy(() => import('./CommentsPanel'));

export default function LightweightPostModal({ 
  isOpen, 
  onClose, 
  post, 
  videoElement, 
  isVideo = false,
  initialComments = false,
}: LightweightPostModalProps) {
  const [showComments, setShowComments] = useState(initialComments);
  const [commentsWide, setCommentsWide] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likes);
  const [commentCount, setCommentCount] = useState(post.comments);
  const [liked, setLiked] = useState(post.isLiked);
  const [showShare, setShowShare] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const ownsPlayer = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Move the feed player into the viewer and make it an actual player.
  // The card size and missing controls made the frame look like a still.
  useLayoutEffect(() => {
    if (!isOpen || !isVideo || !videoElement || !videoContainerRef.current || ownsPlayer.current) return;

    const parent = videoElement.parentElement;
    const previousStyle = videoElement.getAttribute('style');
    const hadControls = videoElement.controls;

    videoContainerRef.current.appendChild(videoElement);
    videoElement.controls = true;
    videoElement.playsInline = true;
    videoElement.style.width = '100%';
    videoElement.style.height = '100%';
    videoElement.style.maxHeight = '100%';
    videoElement.style.objectFit = 'contain';
    videoElement.style.background = '#000';

    const startPlayback = () => {
      videoElement.play().catch(() => {
        videoElement.muted = true;
        videoElement.play().catch(() => {});
      });
    };
    if (videoElement.readyState >= 2) startPlayback();
    else videoElement.addEventListener('loadeddata', startPlayback, { once: true });

    return () => {
      videoElement.removeEventListener('loadeddata', startPlayback);
      videoElement.controls = hadControls;
      if (previousStyle == null) videoElement.removeAttribute('style');
      else videoElement.setAttribute('style', previousStyle);
      if (parent && !parent.contains(videoElement)) parent.appendChild(videoElement);
    };
  }, [isOpen, isVideo, videoElement, post.id]);

  useEffect(() => {
    setLikeCount(post.likes);
    setCommentCount(post.comments);
    setLiked(post.isLiked);
  }, [post.id, post.likes, post.comments, post.isLiked]);

  const toggleLike = useCallback(async () => {
    const next = !liked;
    setLiked(next);
    setLikeCount((count) => Math.max(0, count + (next ? 1 : -1)));
    try {
      const res = await fetch(`/api/posts/${post.id}/like`, { method: 'POST' });
      if (!res.ok) throw new Error('like failed');
      const data = await res.json().catch(() => null);
      if (typeof data?.likes === 'number') setLikeCount(data.likes);
      if (typeof data?.liked === 'boolean') setLiked(data.liked);
    } catch {
      setLiked(!next);
      setLikeCount((count) => Math.max(0, count + (next ? -1 : 1)));
    }
  }, [liked, post.id]);

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
    };
  }, [isOpen, onClose]);

  // Optimized close handler
  const handleClose = useCallback(() => {
    setShowComments(false);
    setCommentsWide(false);
    onClose();
  }, [onClose]);

  // Optimized comments toggle
  const toggleComments = useCallback(() => {
    setShowComments(prev => !prev);
  }, []);

  if (!isOpen || !mounted) return null;

  const fallbackVideoSrc = post.videoUrl
    ? (post.videoUrl.startsWith('/api/video') || post.videoUrl.startsWith('blob:')
        ? post.videoUrl
        : `/api/video?url=${encodeURIComponent(post.videoUrl)}`)
    : undefined;
  if (isVideo && !videoElement && fallbackVideoSrc) ownsPlayer.current = true;

  const modalContent = (
    <div
      ref={modalRef}
      className="fixed bottom-0 right-0 top-0 left-20 z-40 flex bg-white"
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b bg-white px-4 py-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="gap-1 px-2"
            aria-label="Back to feed"
          >
            <ArrowLeft size={16} />
            Back
          </Button>
          {post.author.username ? (
            <Link href={`/people/${encodeURIComponent(post.author.username)}`} className="flex min-w-0 items-center gap-3 hover:underline">
              <Avatar className="h-8 w-8">
                <AvatarImage src={post.author.avatar} alt={post.author.name} />
                <AvatarFallback>{post.author.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{post.author.name}</p>
                <p className="text-xs text-gray-500">
                  {new Date(post.createdAt).toLocaleDateString()}
                </p>
              </div>
            </Link>
          ) : (
            <>
              <Avatar className="h-8 w-8">
                <AvatarImage src={post.author.avatar} alt={post.author.name} />
                <AvatarFallback>{post.author.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{post.author.name}</p>
                <p className="text-xs text-gray-500">
                  {new Date(post.createdAt).toLocaleDateString()}
                </p>
              </div>
            </>
          )}
        </div>

        {isVideo ? (
        <div
          ref={videoContainerRef}
          className="relative flex min-h-0 flex-1 items-center justify-center bg-black"
        >
          {videoElement ? null : fallbackVideoSrc ? (
            <video
              key={fallbackVideoSrc}
              src={fallbackVideoSrc}
              poster={post.thumbnailUrl || undefined}
              controls
              autoPlay
              playsInline
              className="h-full w-full bg-black object-contain"
            />
          ) : post.thumbnailUrl ? (
            <img src={post.thumbnailUrl} alt="" className="max-h-full max-w-full object-contain" />
          ) : (
            <div className="px-8 text-center text-white">
              <p className="text-lg">{post.content}</p>
            </div>
          )}
        </div>
        ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-[#F6F3EE]">
          {youtubeIdFromText(post.content) ? (
            <div className="bg-black" style={{ aspectRatio: '16 / 9' }}>
              <iframe
                src={youtubeEmbedSrc(youtubeIdFromText(post.content) as string, true)}
                title="YouTube video"
                className="h-full w-full"
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : null}
          <div className="px-6 py-6 sm:px-8">
            {(() => {
              const parts = parseFeedPost(post.content)
              const video = youtubeIdFromText(post.content)
              const article = !video && parts.url
              const picture = parts.image || post.thumbnailUrl || post.mediaUrl || ''
              return (
                <>
                  {!article && picture ? (
                    <img
                      src={picture}
                      alt=""
                      className="mb-4 max-h-[58vh] w-full rounded-xl object-contain"
                    />
                  ) : null}
                  {parts.note.split('\n').filter(Boolean).map((line, index) => (
                    <p key={index} className="text-[17px] leading-8 text-[#1C1917]">{line}</p>
                  ))}
                  {article ? (
                    <a
                      href={parts.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 block overflow-hidden rounded-xl border border-[#E7E5E4] bg-white"
                    >
                      {picture ? (
                        <div className="h-[150px] overflow-hidden bg-gray-100">
                          <img src={picture} alt="" className="h-full w-full object-cover object-center" />
                        </div>
                      ) : null}
                      <div className="px-4 py-3">
                        <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
                          {(parts.site || (() => { try { return new URL(parts.url).hostname.replace(/^www\./, '') } catch { return '' } })())}
                          {parts.published ? ` · ${parts.published}` : ''}
                        </div>
                        {parts.title ? <div className="mt-1 text-[15px] font-semibold leading-5">{parts.title}</div> : null}
                      </div>
                    </a>
                  ) : null}
                </>
              )
            })()}
          </div>
        </div>
        )}

        <div className="border-t bg-white p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="gap-2" onClick={toggleLike} aria-label={liked ? 'Unlike' : 'Like'}>
                <Heart size={16} className={liked ? 'fill-orange-500 text-orange-500' : ''} />
                <span>{likeCount}</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={toggleComments} className="gap-2">
                <MessageCircle size={16} />
                <span>{commentCount}</span>
              </Button>
              <Button type="button" variant="ghost" size="sm" className="gap-2" onClick={() => setShowShare(true)} aria-label="Share">
                <Share2 size={16} />
                <span>{post.shares}</span>
              </Button>
            </div>
            <Button variant="ghost" size="sm" aria-label="Save">
              <Bookmark size={16} />
            </Button>
          </div>
        </div>
      </div>

      {showComments && (
        <div className={commentsWide
          ? 'absolute inset-y-0 right-0 z-10 flex w-[90%] flex-col border-l bg-white shadow-2xl'
          : 'flex h-full w-[420px] shrink-0 flex-col border-l bg-white'
        }>
          <Suspense fallback={
            <div className="p-4 text-center text-gray-500">
              Loading comments...
            </div>
          }>
            <CommentsPanel
              postId={post.id}
              caption={post.content}
              expanded={commentsWide}
              onToggleExpand={() => setCommentsWide((wide) => !wide)}
              onClose={() => {
                setShowComments(false);
                setCommentsWide(false);
              }}
              onCountChange={setCommentCount}
            />
          </Suspense>
        </div>
      )}
    </div>
  );

  const shareUrl = typeof window === 'undefined' ? `/post/${post.id}` : `${window.location.origin}/post/${post.id}`;

  return createPortal(
    <>
      {modalContent}
      <ShareSheet
        open={showShare}
        onClose={() => setShowShare(false)}
        url={shareUrl}
        title="Check out this post on Carrot"
      />
    </>,
    document.body,
  );
}
