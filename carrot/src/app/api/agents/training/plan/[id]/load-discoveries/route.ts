import { NextResponse } from 'next/server';
import { TrainingStore } from '@/lib/ai-agents/trainingStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/agents/training/plan/[id]/load-discoveries - Load discoveries from database
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ ok: false, message: 'plan id required' }, { status: 400 });

  const plan = TrainingStore.getPlan(id);
  if (!plan) return NextResponse.json({ ok: false, message: 'plan not found' }, { status: 404 });

  try {
    const discoveries = await TrainingStore.loadDiscoveriesFromDatabase(id);
    return NextResponse.json({ 
      ok: true, 
      planId: id, 
      discoveries,
      count: discoveries.length 
    });
  } catch (error) {
    console.error('[Load Discoveries API] Error:', error);
    return NextResponse.json({ 
      ok: false, 
      message: 'Failed to load discoveries from database',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
