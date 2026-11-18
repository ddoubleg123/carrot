import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';

function snippet(text: string, max = 140) {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1)}…`;
}

type NotificationItem = {
  id: string;
  kind: 'comment' | 'like';
  createdAt: Date;
  postId: string;
  actor: { name: string | null; username: string | null; image: string | null; profilePhoto: string | null };
  text: string;
  post: string;
};

const CACHE_MS = 45_000;
const cache = new Map<string, { at: number; items: NotificationItem[] }>();
const inflight = new Map<string, Promise<NotificationItem[]>>();

async function loadItems(userId: string): Promise<NotificationItem[]> {
  const hit = cache.get(userId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.items;
  const pending = inflight.get(userId);
  if (pending) return pending;

  const request = (async () => {
    const [comments, likes] = await Promise.all([
      prisma.comment.findMany({
        where: { post: { userId }, userId: { not: userId } },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          text: true,
          createdAt: true,
          postId: true,
          user: { select: { name: true, username: true, image: true, profilePhoto: true } },
          post: { select: { content: true } },
        },
      }),
      prisma.postLike.findMany({
        where: { post: { userId }, userId: { not: userId } },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          createdAt: true,
          postId: true,
          user: { select: { name: true, username: true, image: true, profilePhoto: true } },
          post: { select: { content: true } },
        },
      }),
    ]);

    const items = [
      ...comments.map((comment) => ({
        id: `comment-${comment.id}`,
        kind: 'comment' as const,
        createdAt: comment.createdAt,
        postId: comment.postId,
        actor: comment.user,
        text: snippet(comment.text),
        post: snippet(comment.post.content, 80),
      })),
      ...likes.map((like) => ({
        id: `like-${like.id}`,
        kind: 'like' as const,
        createdAt: like.createdAt,
        postId: like.postId,
        actor: like.user,
        text: '',
        post: snippet(like.post.content, 80),
      })),
    ].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    return items;
  })().finally(() => {
    inflight.delete(userId);
  });

  inflight.set(userId, request);
  const items = await request;
  cache.set(userId, { at: Date.now(), items });
  return items;
}

export async function GET() {
  try {
    const session = await auth();
    const userId = (session as { user?: { id?: string } } | null)?.user?.id;
    if (!userId) {
      return NextResponse.json({ items: [] }, { status: 401 });
    }

    const items = await loadItems(userId);
    return NextResponse.json({ items });
  } catch (error) {
    console.error('[api/notifications]', error instanceof Error ? error.message : 'failed');
    return NextResponse.json({ items: [], error: 'Notifications are unavailable right now.' }, { status: 500 });
  }
}
