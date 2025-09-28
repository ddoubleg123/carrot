import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: patchId } = await context.params;
    const body = await request.json();
    const { title, url, author, publisher } = body;

    // Validate input
    if (!title || !url) {
      return NextResponse.json(
        { error: 'Title and URL are required' },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
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

    // Create source
    const source = await prisma.source.create({
      data: {
        patchId: patchId,
        title,
        url,
        author: author || null,
        publisher: publisher || null,
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
