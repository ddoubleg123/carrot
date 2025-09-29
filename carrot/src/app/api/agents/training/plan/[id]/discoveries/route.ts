import { NextResponse } from 'next/server';
import { TrainingStore } from '@/lib/ai-agents/trainingStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ ok: false, message: 'plan id required' }, { status: 400 });

  const url = new URL(req.url);
  const topic = url.searchParams.get('topic') || undefined;
  const status = url.searchParams.get('status') as any;
  const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit') || '50', 10) : 50;

  const plan = TrainingStore.getPlan(id);
  if (!plan) return NextResponse.json({ ok: false, message: 'plan not found' }, { status: 404 });

  const items = TrainingStore.listDiscoveries(id, { topic, status, limit: isFinite(limit) ? limit : 50 });
  return NextResponse.json({ ok: true, planId: id, items });
}
