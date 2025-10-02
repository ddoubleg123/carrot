import { NextResponse } from 'next/server';
import { TrainingStore } from '@/lib/ai-agents/trainingStore';
import { PrismaClient } from '@prisma/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/agents/training/discoveries - Get discoveries for all agents
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '200');
    const topic = url.searchParams.get('topic');
    const status = url.searchParams.get('status');
    const agentId = url.searchParams.get('agentId');

    const prisma = new PrismaClient();

    // Get all plan IDs; if in-memory/file store is empty (e.g., after restart), fall back to DB
    let planIds = TrainingStore.listPlanIds();
    if (!planIds.length) {
      try {
        const rows = await (prisma as any).trainingPlan.findMany({ select: { id: true } });
        planIds = (rows || []).map((r: any) => r.id);
      } catch {}
    }
    
    // Collect discoveries from all plans
    let allDiscoveries: any[] = [];
    
    for (const planId of planIds) {
      const plan = TrainingStore.getPlan(planId);
      // If the plan isn't in FS cache, attempt to load minimal plan from DB
      let agentForPlan: string | null = plan?.agentId || null;
      let planStatus: string | null = plan?.status || null;
      if (!plan) {
        try {
          const row = await (prisma as any).trainingPlan.findUnique({ where: { id: planId }, select: { agentId: true, status: true } });
          agentForPlan = row?.agentId || null;
          planStatus = row?.status || null;
        } catch {}
      }
      if (!agentForPlan) continue;

      // Filter by agentId if specified
      if (agentId && agentForPlan !== agentId) continue;

      // Read from FS cache first; if empty, pull from DB and hydrate cache
      let discoveries = TrainingStore.listDiscoveries(planId, { limit: 1000 });
      if (!discoveries.length) {
        try {
          const dbItems = await TrainingStore.loadDiscoveriesFromDatabase(planId);
          if (dbItems.length) {
            discoveries = TrainingStore.listDiscoveries(planId, { limit: 1000 });
          }
        } catch {}
      }

      const enrichedDiscoveries = discoveries.map(d => ({
        ...d,
        agentId: agentForPlan!,
        agentName: agentForPlan!, // TODO: hydrate actual name if needed
        planStatus: planStatus || 'unknown'
      }));
      allDiscoveries.push(...enrichedDiscoveries);
    }
    
    // Apply filters
    if (topic && topic !== '__all__') {
      allDiscoveries = allDiscoveries.filter(d => d.topic === topic);
    }
    
    if (status && status !== '__all__') {
      allDiscoveries = allDiscoveries.filter(d => d.status === status);
    }
    
    // Sort by timestamp (newest first)
    allDiscoveries.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
    
    // Apply limit
    const limitedDiscoveries = allDiscoveries.slice(0, limit);
    
    // Calculate stats
    const stats = {
      total: allDiscoveries.length,
      byStatus: {
        retrieved: allDiscoveries.filter(d => d.status === 'retrieved').length,
        fed: allDiscoveries.filter(d => d.status === 'fed').length,
        failed: allDiscoveries.filter(d => d.status === 'failed').length,
        filtered: allDiscoveries.filter(d => d.status === 'filtered').length,
      },
      byAgent: {} as Record<string, number>
    };
    
    // Count by agent
    for (const discovery of allDiscoveries) {
      stats.byAgent[discovery.agentId] = (stats.byAgent[discovery.agentId] || 0) + 1;
    }
    
    return NextResponse.json({
      ok: true,
      discoveries: limitedDiscoveries,
      stats,
      totalPlans: planIds.length
    });
    
  } catch (error) {
    console.error('[All Discoveries API] Error:', error);
    return NextResponse.json({
      ok: false,
      error: 'Failed to fetch discoveries',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
