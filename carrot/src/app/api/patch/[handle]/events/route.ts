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
    const { title, summary, dateStart, dateEnd, tags = [], media, sourceIds = [] } = body;

    if (!title || !summary || !dateStart) {
      return NextResponse.json({ error: 'Title, summary, and dateStart are required' }, { status: 400 });
    }

    // Create new event
    const event = await prisma.event.create({
      data: {
        title,
        summary,
        dateStart: new Date(dateStart),
        dateEnd: dateEnd ? new Date(dateEnd) : null,
        tags,
        media: media || null,
        patchId,
        sourceIds
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
