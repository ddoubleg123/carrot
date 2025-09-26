import { NextRequest, NextResponse } from 'next/server';
import CarrotIntegration from '@/lib/ai-agents/carrotIntegration';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/agents/carrot/feed - Feed Carrot content to agents
export async function POST(req: Request, _ctx: { params: Promise<{}> }) {
  try {
    const body = await req.json();
    const { 
      patchId, 
      content, 
      sourceType = 'post',
      sourceId 
    } = body;

    if (!patchId || !content) {
      return NextResponse.json(
        { error: 'patchId and content are required' },
        { status: 400 }
      );
    }

    const results = await CarrotIntegration.feedCarrotContentToAgents(
      patchId,
      content,
      sourceType,
      sourceId
    );

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Error feeding Carrot content to agents:', error);
    return NextResponse.json(
      { error: 'Failed to feed Carrot content to agents' },
      { status: 500 }
    );
  }
}
