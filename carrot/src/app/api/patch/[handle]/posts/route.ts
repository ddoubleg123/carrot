import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { showFollowers } from '@/lib/activityFeed';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ handle: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { handle: patchHandle } = await params;
    
    // Find the patch by handle
    const patch = await prisma.patch.findUnique({
      where: { handle: patchHandle }
    });
    
    if (!patch) {
      return NextResponse.json({ error: 'Patch not found' }, { status: 404 });
    }
    
    const patchId = patch.id;

    const body = await req.json();
    const { type, title, body: postBody, sourceIds = [] } = body;

    if (!type || !title || !postBody) {
      return NextResponse.json({ error: 'Type, title, and body are required' }, { status: 400 });
    }

    // Create new patch post
    const patchPost = await prisma.patchPost.create({
      data: {
        type,
        title,
        body: postBody,
        patchId,
        authorId: session.user.id,
        tags: [],
        metrics: { likes: 0, comments: 0, reposts: 0, views: 0 }
      }
    });

    await showFollowers(session.user.id, `Posted on ${patch.title}: ${title} /patch/${patchHandle}`)
    return NextResponse.json({
      success: true,
      post: patchPost
    });
  } catch (error) {
    console.error('Error creating patch post:', error);
    return NextResponse.json(
      { error: 'Failed to create patch post' },
      { status: 500 }
    );
  }
}