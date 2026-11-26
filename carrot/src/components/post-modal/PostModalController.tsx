"use client";
import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { patchConversation } from "../../lib/feedPost";
import { isFinishedQuote, pickQuoteCard } from "../../lib/curator/quoteCardPick";
import LightweightPostModal from "./LightweightPostModal";
import { useModalRoute } from "../../hooks/useModalRoute";
import { recallPost, rememberPost, usePostModal, usePostSnapshots, type PostSnapshot } from "./postModalStore";

function snapshotFromApi(post: any): PostSnapshot {
  const user = post?.User || {};
  let imageList: string[] = [];
  if (Array.isArray(post?.imageUrls)) imageList = post.imageUrls.filter(Boolean);
  else if (typeof post?.imageUrls === 'string') {
    try {
      const parsed = JSON.parse(post.imageUrls);
      if (Array.isArray(parsed)) imageList = parsed.filter(Boolean);
    } catch {}
  }
  const imageUrl = post?.gifUrl
    || (imageList.length && imageList.every(isFinishedQuote) ? pickQuoteCard(imageList, String(post.id)) : '')
    || imageList[0]
    || post?.thumbnailUrl
    || undefined;
  const hasVideo = Boolean(post?.videoUrl || post?.cfUid || post?.cfPlaybackUrlHls);
  const created = post?.createdAt ? new Date(post.createdAt) : new Date();
  const displayName = String(user.name || '').trim() || user.username || 'Someone';
  return {
    id: String(post.id),
    content: post.content || '',
    author: {
      id: String(user.id || post.userId || 'temp'),
      name: displayName,
      username: user.username || undefined,
      avatar: user.profilePhoto || user.image || undefined,
    },
    mediaUrl: hasVideo ? (post.videoUrl || post.thumbnailUrl || undefined) : imageUrl,
    thumbnailUrl: post.thumbnailUrl || imageUrl || undefined,
    videoUrl: post.videoUrl || undefined,
    mediaType: hasVideo ? 'video' : imageUrl ? 'image' : undefined,
    likes: post.likes ?? 0,
    comments: post.comments ?? 0,
    shares: post.reposts ?? 0,
    isLiked: false,
    isBookmarked: false,
    createdAt: Number.isNaN(created.getTime()) ? new Date().toISOString() : created.toISOString(),
  };
}

function addressModal() {
  if (typeof window === 'undefined') return null;
  const sp = new URLSearchParams(window.location.search);
  if (sp.get('modal') !== '1') return null;
  return { postId: sp.get('post') || '', panel: sp.get('panel') };
}

export default function PostModalController() {
  const params = useSearchParams();
  const router = useRouter();
  const { closePostModal } = useModalRoute();
  const live = usePostModal();
  usePostSnapshots();
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    if (live) setDismissed(false);
  }, [live]);
  // Back writes the address bar with history.replaceState. Next keeps the old
  // search params after that, which left the post open after Back.
  const fromAddress = addressModal();
  const fromParams = params?.get('modal') === '1'
    ? { postId: params.get('post') || '', panel: params.get('panel') }
    : null;
  const routed = typeof window === 'undefined' ? fromParams : fromAddress;
  const show = !dismissed && (live != null || routed != null);
  const postId = live?.postId || routed?.postId || '';
  const panel = live?.panel ?? routed?.panel ?? null;

  const rememberedEarly = postId ? recallPost(postId) : null;
  const patchTalk = patchConversation(rememberedEarly?.content);
  useEffect(() => {
    if (!patchTalk) return;
    router.replace(patchTalk);
  }, [patchTalk, router]);

  useEffect(() => {
    if (!postId || patchTalk || recallPost(postId)) return;
    let cancelled = false;
    fetch(`/api/posts/${encodeURIComponent(postId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((post) => {
        if (!cancelled && post?.id) rememberPost(snapshotFromApi(post));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [postId]);

  if (!show || !postId) return null;

  const videoElement = typeof document === 'undefined'
    ? null
    : document.querySelector(`[data-post-video-id="${postId}"]`) as HTMLVideoElement | null;
  const remembered = recallPost(postId);
  const isVideo = !!videoElement || remembered?.mediaType === 'video';

  const post = remembered ?? {
    id: postId,
    content: '',
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
    <LightweightPostModal
      isOpen={show}
      onClose={() => {
        setDismissed(true);
        closePostModal();
      }}
      post={post}
      videoElement={videoElement}
      isVideo={!!videoElement || remembered?.mediaType === 'video'}
      initialComments={panel === 'comments'}
    />
  );
}
