import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';

// POST /api/posts - create a new post
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await req.json();
  const {
    content,
    gradientDirection,
    gradientFromColor,
    gradientViaColor,
    gradientToColor,
    imageUrls,
    gifUrl,
    audioUrl,
    emoji,
    carrotText,
    stickText,
  } = body;
  try {
    const post = await prisma.post.create({
      data: {
        userId: session.user.id,

        gradientDirection,
        gradientFromColor,
        gradientViaColor,
        gradientToColor,
        imageUrls: Array.isArray(imageUrls)
          ? JSON.stringify(imageUrls)
          : typeof imageUrls === 'string'
            ? JSON.stringify([imageUrls])
            : '[]',
        gifUrl,
        audioUrl,
        emoji,
        carrotText,
        stickText,
      },
      include: { user: true },
    });
    return NextResponse.json(post, { status: 201 });
  } catch (error) {
    console.error('Error creating post:', error);
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 });
  }
}

// GET /api/posts - get all posts (latest first)
export async function GET() {
  try {
    const posts = await prisma.post.findMany({
      orderBy: { createdAt: 'desc' },
      include: { user: true },
    });
    return NextResponse.json(posts);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 });
  }
}
