import { NextResponse } from 'next/server';
import { TrainingStore } from '@/lib/ai-agents/trainingStore';
import { startTrainingOrchestrator } from '@/lib/ai-agents/trainingOrchestrator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ ok: false, message: 'plan id required' }, { status: 400 });

  let body: any = {};
  try { body = await req.json(); } catch {}
  const pause = !!body?.pause;

  const plan = TrainingStore.getPlan(id);
  if (!plan) return NextResponse.json({ ok: false, message: 'plan not found' }, { status: 404 });

  plan.options = {
    ...plan.options,
    pauseDiscovery: pause,
  };
  // Ensure orchestrator is running so queued tasks feed immediately when paused or resumed
  startTrainingOrchestrator();

  TrainingStore.updatePlan(plan);
  return NextResponse.json({ ok: true, plan });
}
