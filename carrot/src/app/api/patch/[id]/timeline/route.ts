import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: patchId } = await params;
    const { searchParams } = new URL(req.url);
    
    const tag = searchParams.get('tag');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    // Build where clause
    const where: any = { patchId };

    if (tag) {
      where.tags = {
        has: tag
      };
    }

    if (from || to) {
      where.dateStart = {};
      if (from) {
        where.dateStart.gte = new Date(from);
      }
      if (to) {
        where.dateStart.lte = new Date(to);
      }
    }

    const events = await prisma.event.findMany({
      where,
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
      orderBy: {
        dateStart: 'desc'
      }
    });

    // Convert to TimelineJS format
    const timelineData = {
      events: events.map(event => ({
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
        media: event.media ? {
          url: (event.media as any).url,
          caption: (event.media as any).alt || '',
          credit: event.sources[0]?.author || ''
        } : undefined,
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
