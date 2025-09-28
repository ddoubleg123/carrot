import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: patchId } = await params;
    const body = await req.json();
    const { type, title, content, tags, media, url } = body;

    // Validate input
    if (!type || !['CARROT', 'TEXT', 'LINK', 'IMAGE', 'VIDEO'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid post type' },
        { status: 400 }
      );
    }

    if (!title && !content) {
      return NextResponse.json(
        { error: 'Title or content is required' },
        { status: 400 }
      );
    }

    // Verify patch exists
    const patch = await prisma.patch.findUnique({
      where: { id: patchId }
    });

    if (!patch) {
      return NextResponse.json(
        { error: 'Patch not found' },
        { status: 404 }
      );
    }

    // Create patch post
    const patchPost = await prisma.patchPost.create({
      data: {
        patchId: patchId,
        authorId: session.user.id,
        type: type as any,
        title: title || null,
        body: content || null,
        media: media || null,
        url: url || null,
        tags: tags ? tags.split(',').map((tag: string) => tag.trim()) : [],
        metrics: {
          likes: 0,
          comments: 0,
          reposts: 0,
          views: 0
        }
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            username: true,
            image: true
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      post: patchPost
    });
  } catch (error) {
    console.error('Error creating patch post:', error);
    return NextResponse.json(
      { error: 'Failed to create post' },
      { status: 500 }
    );
  }
}
