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
    const { title, summary, dateStart, dateEnd, tags, sourceUrl, media } = body;

    // Validate input
    if (!title || !summary || !dateStart) {
      return NextResponse.json(
        { error: 'Title, summary, and start date are required' },
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

    // Create source if sourceUrl is provided
    let sourceIds: string[] = [];
    if (sourceUrl) {
      const source = await prisma.source.create({
        data: {
          patchId: patchId,
          title: title,
          url: sourceUrl,
          addedBy: session.user.id
        }
      });
      sourceIds = [source.id];
    }

    // Create event
    const event = await prisma.event.create({
      data: {
        patchId: patchId,
        title,
        summary,
        dateStart: new Date(dateStart),
        dateEnd: dateEnd ? new Date(dateEnd) : null,
        media: media || null,
        tags: tags ? tags.split(',').map((tag: string) => tag.trim()) : [],
        sourceIds
      },
      include: {
        sources: {
          select: {
            id: true,
            title: true,
            url: true,
            author: true
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      event
    });
  } catch (error) {
    console.error('Error creating event:', error);
    return NextResponse.json(
      { error: 'Failed to create event' },
      { status: 500 }
    );
  }
}
