import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { invalidateFeedCache } from '@/lib/feedCache';
import { showFollowers } from '@/lib/activityFeed';

function commentAuthor(user: {
  id: string;
  name: string | null;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  image: string | null;
  profilePhoto: string | null;
}) {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return {
    id: user.id,
    name: user.name || fullName || user.username || 'Someone',
    avatar: user.profilePhoto || user.image,
  };
}

const authorSelect = {
  id: true,
  name: true,
  username: true,
  firstName: true,
  lastName: true,
  image: true,
  profilePhoto: true,
} as const;

const commentsInflight = new Map<string, Promise<{
  comments: Array<{
    id: string;
    content: string;
    author: { id: string; name: string | null; avatar: string | null };
    createdAt: string;
    likes: number;
    isLiked: boolean;
  }>;
  total: number;
}>>();

function loadComments(postId: string) {
  const existing = commentsInflight.get(postId);
  if (existing) return existing;
  const pending = (async () => {
    const [rows, total] = await Promise.all([
      prisma.comment.findMany({
        where: { postId },
        include: {
          user: { select: authorSelect },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }).catch((error) => {
        console.error('Database error fetching comments:', error);
        return [];
      }),
      prisma.comment.count({ where: { postId } }).catch(() => 0),
    ]);
    return {
      comments: rows.map(comment => ({
        id: comment.id,
        content: comment.text,
        author: commentAuthor(comment.user),
        createdAt: comment.createdAt.toISOString(),
        likes: 0,
        isLiked: false,
      })),
      total,
    };
  })().finally(() => {
    commentsInflight.delete(postId);
  });
  commentsInflight.set(postId, pending);
  return pending;
}

// GET /api/comments?postId=xxx
export async function GET(request: Request, context: { params: Promise<{}> }) {
  try {
    const { searchParams } = new URL(request.url);
    const postId = searchParams.get('postId');

    if (!postId) {
      return NextResponse.json(
        { error: 'Post ID is required' },
        { status: 400 }
      );
    }

    const { comments, total } = await loadComments(postId);

    return NextResponse.json({
      success: true,
      comments,
      total,
    });

  } catch (error) {
    console.error('Error fetching comments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch comments' },
      { status: 500 }
    );
  }
}

// POST /api/comments
export async function POST(request: Request, context: { params: Promise<{}> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { postId, content } = body;

    if (!postId || !content?.trim()) {
      return NextResponse.json(
        { error: 'Post ID and content are required' },
        { status: 400 }
      );
    }

    // Verify post exists
    const post = await prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    // Create comment
    const comment = await prisma.comment.create({
      data: {
        text: content.trim(),
        postId: postId,
        userId: session.user.id,
      },
      include: {
        user: { select: authorSelect },
      },
    });

    // Transform comment to match expected format
    const transformedComment = {
      id: comment.id,
      content: comment.text,
      author: commentAuthor(comment.user),
      createdAt: comment.createdAt.toISOString(),
      likes: 0,
      isLiked: false,
    };

    const { bucketOf, recordInterest } = await import('@/lib/recordInterest')
    await recordInterest(session.user.id, bucketOf(post), 'comment', `comment:${postId}`).catch((error) => {
      console.error('[interest] comment', error)
    })
    invalidateFeedCache();
    await showFollowers(session.user.id, `Commented: ${content.trim().slice(0, 220)}`)
    return NextResponse.json(transformedComment, { status: 201 });

  } catch (error) {
    console.error('Error creating comment:', error);
    return NextResponse.json(
      { error: 'Failed to create comment' },
      { status: 500 }
    );
  }
}