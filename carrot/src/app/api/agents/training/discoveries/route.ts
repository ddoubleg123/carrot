import { NextResponse } from 'next/server';
import { TrainingStore } from '@/lib/ai-agents/trainingStore';

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

    // Get all plan IDs
    const planIds = TrainingStore.listPlanIds();
    
    // Collect discoveries from all plans
    let allDiscoveries: any[] = [];
    
    for (const planId of planIds) {
      const plan = TrainingStore.getPlan(planId);
      if (!plan) continue;
      
      // Filter by agentId if specified
      if (agentId && plan.agentId !== agentId) continue;
      
      const discoveries = TrainingStore.listDiscoveries(planId, { limit: 1000 });
      
      // Add plan and agent info to each discovery
      const enrichedDiscoveries = discoveries.map(d => ({
        ...d,
        agentId: plan.agentId,
        agentName: plan.agentId, // Could be enhanced with actual agent name
        planStatus: plan.status
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
        failed: allDiscoveries.filter(d => d.status === 'failed').length
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
