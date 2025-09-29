import { NextResponse } from 'next/server';
import { getBatch } from '@/lib/server/batchStore';
import { TrainingStore } from '@/lib/ai-agents/trainingStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ ok: false, message: 'id required' }, { status: 400 });
  const batch = await getBatch(id);
  if (!batch) return NextResponse.json({ ok: false, message: 'not found' }, { status: 404 });

  // Reconcile live progress from TrainingPlans
  let totalFed = 0;
  let totalDiscovered = 0;
  for (const t of batch.tasks) {
    if (!t.planId) continue;
    const plan = TrainingStore.getPlan(t.planId);
    if (!plan) continue;
    const pt = plan.totals;
    const fed = pt.fed || 0;
    const discovered = (pt.fed || 0) + (pt.failed || 0) + (pt.skipped || 0) + (pt.running || 0) + (pt.queued || 0) + (pt.done || 0);
    t.itemsFed = fed;
    t.itemsPlanned = discovered;
    totalFed += fed;
    totalDiscovered += discovered;
  }
  batch.totals.fed = totalFed;
  batch.totals.discovered = totalDiscovered;

  return NextResponse.json({ ok: true, batch });
}
