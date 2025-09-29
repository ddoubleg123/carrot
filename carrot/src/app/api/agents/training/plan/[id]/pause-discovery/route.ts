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

  // Toggle pause
  plan.options = { ...plan.options, pauseDiscovery: pause };

  // Adjust pacing when paused to drain queue faster; restore on resume
  const DEFAULT_FEED_ONLY = { throttleMs: 1500, maxTasksPerTick: 3 };
  plan.meta = plan.meta || {};
  if (pause) {
    // Save original pacing once
    if (!plan.meta.origPacing) {
      plan.meta.origPacing = {
        throttleMs: plan.options.throttleMs,
        maxTasksPerTick: plan.options.maxTasksPerTick,
      };
    }
    plan.options.throttleMs = DEFAULT_FEED_ONLY.throttleMs;
    plan.options.maxTasksPerTick = DEFAULT_FEED_ONLY.maxTasksPerTick;
  } else if (plan.meta.origPacing) {
    // Restore
    plan.options.throttleMs = plan.meta.origPacing.throttleMs;
    plan.options.maxTasksPerTick = plan.meta.origPacing.maxTasksPerTick;
    delete plan.meta.origPacing;
  }
  // Ensure orchestrator is running so queued tasks feed immediately when paused or resumed
  startTrainingOrchestrator();

  TrainingStore.updatePlan(plan);
  return NextResponse.json({ ok: true, plan });
}
