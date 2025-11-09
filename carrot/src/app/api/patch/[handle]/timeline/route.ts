import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ handle: string }> }
) {
  try {
    const { handle: patchHandle } = await params;
    
    // Find the patch by handle
    const patch = await prisma.patch.findUnique({
      where: { handle: patchHandle }
    });
    
    if (!patch) {
      return NextResponse.json({ error: 'Patch not found' }, { status: 404 });
    }
    
    const patchId = patch.id;

    const { searchParams } = new URL(req.url);
    const tag = searchParams.get('tag');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    // Build where clause for events
    const whereClause: any = { patchId };
    
    if (tag) {
      whereClause.tags = {
        has: tag
      };
    }
    
    if (from || to) {
      whereClause.dateStart = {};
      if (from) {
        whereClause.dateStart.gte = new Date(from);
      }
      if (to) {
        whereClause.dateStart.lte = new Date(to);
      }
    }

    // Get events with sources
    const events = await prisma.event.findMany({
      where: whereClause,
      include: {
        sources: {
          select: {
            id: true,
            title: true,
            url: true,
            author: true
          }
        }
      },
      orderBy: { dateStart: 'desc' }
    });

    // Format for TimelineJS
    const timelineData = {
      title: {
        media: {
          url: '',
          caption: patch.description
        },
        text: {
          headline: patch.title,
          text: patch.description
        }
      },
      events: events.map(event => ({
        media: event.media ? {
          url: (event.media as any).url,
          caption: (event.media as any).alt || ''
        } : undefined,
        start_date: {
          year: new Date(event.dateStart).getFullYear(),
          month: new Date(event.dateStart).getMonth() + 1,
          day: new Date(event.dateStart).getDate()
        },
        end_date: event.dateEnd ? {
          year: new Date(event.dateEnd).getFullYear(),
          month: new Date(event.dateEnd).getMonth() + 1,
          day: new Date(event.dateEnd).getDate()
        } : undefined,
        text: {
          headline: event.title,
          text: event.summary
        },
        group: event.tags[0] || 'General'
      }))
    };

    return NextResponse.json({
      success: true,
      timeline: timelineData,
      events: events
    });
  } catch (error) {
    console.error('Error fetching timeline data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch timeline data' },
      { status: 500 }
    );
  }
}
