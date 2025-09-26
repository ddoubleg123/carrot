import { NextRequest, NextResponse } from 'next/server';
import FeedService, { FeedItem } from '@/lib/ai-agents/feedService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/agents/[id]/feed - Feed content to agent
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    // DISABLE AI TRAINING ON RENDER FREE TIER
    const isRender = process.env.RENDER === 'true' || process.env.NODE_ENV === 'production';
    
    if (isRender) {
      console.log('[Feed API] AI training disabled on Render - returning mock response');
      return NextResponse.json({
        result: {
          message: 'AI agent training is disabled on the free tier due to memory limitations.',
          suggestion: 'For full AI training capabilities, please run locally or upgrade to a paid server with more memory.',
          mockResult: true,
          memoryIds: [],
          feedEvent: { id: 'mock-event' },
          chunkCount: 0
        }
      }, { status: 201 });
    }

    const { id } = await ctx.params;
    const body = await req.json();
    
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
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const { searchParams } = new URL(req.url);
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
