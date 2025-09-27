import { NextRequest, NextResponse } from 'next/server';
import { FeedService } from '@/lib/ai-agents/feedService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/agents/[id]/memories - Get agent memories
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '20');

    let memories;

    if (query) {
      memories = await FeedService.searchMemories(id, query, limit);
    } else {
      memories = await FeedService.getRecentMemories(id, limit);
    }

    return NextResponse.json({ memories });
  } catch (error) {
    console.error('Error fetching memories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch memories' },
      { status: 500 }
    );
  }
}

// DELETE /api/agents/[id]/memories - Forget memories
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    
    const { memoryIds, fedBy } = body;

    if (!memoryIds || !Array.isArray(memoryIds)) {
      return NextResponse.json(
        { error: 'memoryIds array is required' },
        { status: 400 }
      );
    }

    const result = await FeedService.forgetMemories(id, memoryIds, fedBy);

    return NextResponse.json({ result });
  } catch (error) {
    console.error('Error forgetting memories:', error);
    return NextResponse.json(
      { error: 'Failed to forget memories' },
      { status: 500 }
    );
  }
}
