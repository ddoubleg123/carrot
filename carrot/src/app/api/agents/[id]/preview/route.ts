import { NextRequest, NextResponse } from 'next/server';
import FeedService, { FeedItem } from '@/lib/ai-agents/feedService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/agents/[id]/preview - Preview feed without storing
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
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

    const preview = await FeedService.previewFeed(id, feedItem);

    return NextResponse.json({ preview });
  } catch (error) {
    console.error('Error previewing feed:', error);
    return NextResponse.json(
      { error: 'Failed to preview feed' },
      { status: 500 }
    );
  }
}
