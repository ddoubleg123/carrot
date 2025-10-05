import { NextRequest, NextResponse } from 'next/server';
// import { getServerSession } from 'next-auth/next';
// import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/comments?postId=xxx
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const postId = searchParams.get('postId');

    if (!postId) {
      return NextResponse.json(
        { error: 'Post ID is required' },
        { status: 400 }
      );
    }

    // Fetch comments for the post
    const comments = await prisma.comment.findMany({
      where: {
        postId: postId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    }).catch((error) => {
      console.error('Database error fetching comments:', error);
      return [];
    });

    // Transform comments to match expected format
    const transformedComments = comments.map(comment => ({
      id: comment.id,
      content: comment.text,
      author: {
        id: comment.user.id,
        name: comment.user.name,
        avatar: comment.user.image,
      },
      createdAt: comment.createdAt.toISOString(),
      likes: 0, // Comments don't have likes in this schema
      isLiked: false,
    }));

    return NextResponse.json({
      success: true,
      comments: transformedComments,
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
export async function POST(request: NextRequest) {
  try {
    // const session = await getServerSession(authOptions);
    const session = null; // Temporarily disabled for build

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
        userId: 'temp-user-id', // TODO: Replace with actual user ID when auth is enabled
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    });

    // Transform comment to match expected format
    const transformedComment = {
      id: comment.id,
      content: comment.text,
      author: {
        id: comment.user.id,
        name: comment.user.name,
        avatar: comment.user.image,
      },
      createdAt: comment.createdAt.toISOString(),
      likes: 0,
      isLiked: false,
    };

    return NextResponse.json(transformedComment, { status: 201 });

  } catch (error) {
    console.error('Error creating comment:', error);
    return NextResponse.json(
      { error: 'Failed to create comment' },
      { status: 500 }
    );
  }
}