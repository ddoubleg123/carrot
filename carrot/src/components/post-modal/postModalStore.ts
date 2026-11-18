'use client';

import { useSyncExternalStore } from 'react';

export type PostSnapshot = {
  id: string;
  content: string;
  author: { id: string; name: string; username?: string; avatar?: string };
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
};

const snapshots = new Map<string, PostSnapshot>();

type OpenModal = { postId: string; panel: string | null };

let open: OpenModal | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function sameSnapshot(prev: PostSnapshot | undefined, next: PostSnapshot) {
  if (!prev) return false;
  return prev.content === next.content
    && prev.videoUrl === next.videoUrl
    && prev.mediaUrl === next.mediaUrl
    && prev.thumbnailUrl === next.thumbnailUrl
    && prev.likes === next.likes
    && prev.comments === next.comments
    && prev.shares === next.shares
    && prev.author.name === next.author.name
    && prev.author.username === next.author.username
    && prev.author.avatar === next.author.avatar
    && prev.createdAt === next.createdAt;
}

let snapshotVersion = 0;

export function rememberPost(post: PostSnapshot) {
  const prev = snapshots.get(post.id);
  if (sameSnapshot(prev, post)) return;
  snapshots.set(post.id, post);
  snapshotVersion += 1;
  queueMicrotask(emit);
}

export function usePostSnapshots() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => snapshotVersion,
    () => 0,
  );
}

export function recallPost(id: string): PostSnapshot | null {
  return snapshots.get(id) ?? null;
}

export function setOpenModal(next: OpenModal | null) {
  open = next;
  emit();
}

function getOpenModal() {
  return open;
}

export function usePostModal() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getOpenModal,
    () => null,
  );
}
