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
  const forceDb = url.searchParams.get('forceDb') === 'true';

  const plan = TrainingStore.getPlan(id);
  if (!plan) return NextResponse.json({ ok: false, message: 'plan not found' }, { status: 404 });

  let items = TrainingStore.listDiscoveries(id, { topic, status, limit: isFinite(limit) ? limit : 50 });
  
  // If no items found in file system or forceDb is true, try loading from database
  if ((items.length === 0 || forceDb) && !topic && !status) {
    try {
      console.log(`[Discoveries API] Loading discoveries from database for plan ${id}`);
      const dbItems = await TrainingStore.loadDiscoveriesFromDatabase(id);
      if (dbItems.length > 0) {
        // Re-query with filters applied
        items = TrainingStore.listDiscoveries(id, { topic, status, limit: isFinite(limit) ? limit : 50 });
        console.log(`[Discoveries API] Loaded ${dbItems.length} from DB, returning ${items.length} after filters`);
      }
    } catch (error) {
      console.error('[Discoveries API] Failed to load from database:', error);
    }
  }
  
  return NextResponse.json({ ok: true, planId: id, items, totalFromDb: items.length });
}
