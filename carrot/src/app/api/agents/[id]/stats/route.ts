import { NextRequest, NextResponse } from 'next/server';
import { FeedService } from '@/lib/ai-agents/feedService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/agents/[id]/stats - Get agent statistics
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    
    const stats = await FeedService.getMemoryStats(id);

    return NextResponse.json({ stats });
  } catch (error) {
    console.error('Error fetching agent stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agent stats' },
      { status: 500 }
    );
  }
}
