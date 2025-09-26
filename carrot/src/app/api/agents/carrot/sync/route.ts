import { NextRequest, NextResponse } from 'next/server';
import CarrotIntegration from '@/lib/ai-agents/carrotIntegration';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/agents/carrot/sync - Sync agent knowledge with Carrot content
export async function POST(req: Request, _ctx: { params: Promise<{}> }) {
  try {
    const body = await req.json();
    const { patchId } = body;

    if (!patchId) {
      return NextResponse.json(
        { error: 'patchId is required' },
        { status: 400 }
      );
    }

    await CarrotIntegration.syncAgentKnowledge(patchId);

    return NextResponse.json({ 
      message: 'Agent knowledge synced successfully',
      patchId 
    });
  } catch (error) {
    console.error('Error syncing agent knowledge:', error);
    return NextResponse.json(
      { error: 'Failed to sync agent knowledge' },
      { status: 500 }
    );
  }
}
