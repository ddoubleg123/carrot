import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

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
    const { title, url, author, publisher } = body;

    if (!title || !url) {
      return NextResponse.json({ error: 'Title and URL are required' }, { status: 400 });
    }

    // Create new source
    const source = await prisma.source.create({
      data: {
        title,
        url,
        author: author || null,
        publisher: publisher || null,
        patchId,
        addedBy: session.user.id
      }
    });

    return NextResponse.json({
      success: true,
      source
    });
  } catch (error) {
    console.error('Error creating source:', error);
    return NextResponse.json(
      { error: 'Failed to create source' },
      { status: 500 }
    );
  }
}
