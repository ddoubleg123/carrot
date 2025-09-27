import { NextResponse } from 'next/server';
import { FeedService, FeedItem } from '@/lib/ai-agents/feedService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/agents/[id]/feed - Feed content to agent
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Check if we're on Render and what tier
    const isRender = process.env.RENDER === 'true' || process.env.NODE_ENV === 'production';
    const isRenderFreeTier = isRender && (!process.env.RENDER_SERVICE_ID || process.env.RENDER_SERVICE_ID.includes('free'));
    
    // Check memory limit - paid Render plans have more memory
    const memUsage = process.memoryUsage();
    const memUsageMB = memUsage.heapUsed / 1024 / 1024;
    const totalMemMB = memUsage.heapTotal / 1024 / 1024;
    
    console.log(`[Feed API] Server info: Render=${isRender}, FreeTier=${isRenderFreeTier}, Memory=${memUsageMB.toFixed(2)}MB/${totalMemMB.toFixed(2)}MB`);
    
    // Check memory usage and warn if high, but don't disable
    if (memUsageMB > 800) { // Warn if using more than 800MB
      console.warn(`[Feed API] High memory usage detected: ${memUsageMB.toFixed(2)}MB/${totalMemMB.toFixed(2)}MB`);
    }

    const { id } = await context.params;
    const body = await request.json();
    
    const feedItem: FeedItem = {
      content: body.content,
      sourceType: body.sourceType,
      sourceUrl: body.sourceUrl,
      sourceTitle: body.sourceTitle,
      sourceAuthor: body.sourceAuthor,
      tags: body.tags,
      threadId: body.threadId,
      topicId: body.topicId,
    };

    // Validate required fields
    if (!feedItem.content || !feedItem.sourceType) {
      return NextResponse.json(
        { error: 'Content and sourceType are required' },
        { status: 400 }
      );
    }

    const result = await FeedService.feedAgent(id, feedItem, body.fedBy);

    return NextResponse.json({ result }, { status: 201 });
  } catch (error) {
    console.error('Error feeding agent:', error);
    return NextResponse.json(
      { error: 'Failed to feed agent' },
      { status: 500 }
    );
  }
}

// GET /api/agents/[id]/feed - Get feed history
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');

    const feedHistory = await FeedService.getFeedHistory(id, limit);

    return NextResponse.json({ feedHistory });
  } catch (error) {
    console.error('Error fetching feed history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch feed history' },
      { status: 500 }
    );
  }
}
