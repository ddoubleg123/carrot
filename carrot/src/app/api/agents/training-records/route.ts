import { NextRequest, NextResponse } from 'next/server';
import { AgentSpecificRetriever } from '@/lib/ai-agents/agentSpecificRetriever';
import { TrainingStore } from '@/lib/ai-agents/trainingStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/agents/training-records - Get training records for all agents and current batch status
export async function GET(req: Request) {
  try {
    const trainingRecords = await AgentSpecificRetriever.getAllTrainingRecords();
    
    // Get current training plans status
    const planIds = TrainingStore.listPlanIds();
    const activePlans = planIds
      .map(planId => TrainingStore.getPlan(planId))
      .filter(plan => plan && (plan.status === 'running' || plan.status === 'pending' || plan.status === 'active'))
      .map(plan => ({
        id: plan!.id,
        agentId: plan!.agentId,
        status: plan!.status,
        totals: plan!.totals,
        topics: plan!.topics,
        options: plan!.options
      }));

    // Calculate totals across all active plans
    const totalDiscovered = activePlans.reduce((sum, plan) => sum + (plan.totals?.discovered || 0), 0);
    const totalFed = activePlans.reduce((sum, plan) => sum + (plan.totals?.fed || 0), 0);
    const totalQueued = activePlans.reduce((sum, plan) => sum + (plan.totals?.queued || 0), 0);
    const totalRunning = activePlans.reduce((sum, plan) => sum + (plan.totals?.running || 0), 0);
    const totalDone = activePlans.reduce((sum, plan) => sum + (plan.totals?.done || 0), 0);
    const totalFailed = activePlans.reduce((sum, plan) => sum + (plan.totals?.failed || 0), 0);

    // Create a mock batch status that matches what the frontend expects
    const batchStatus = {
      id: 'current-training-status',
      status: activePlans.length > 0 ? 'running' : 'idle',
      agentIds: activePlans.map(plan => plan.agentId),
      totals: {
        discovered: totalDiscovered,
        fed: totalFed,
        queued: totalQueued,
        running: totalRunning,
        done: totalDone,
        failed: totalFailed
      },
      tasks: activePlans.map(plan => ({
        agentId: plan.agentId,
        planId: plan.id,
        status: plan.status,
        itemsPlanned: plan.totals?.queued || 0,
        itemsFed: plan.totals?.fed || 0,
        topics: plan.topics || []
      })),
      updatedAt: new Date().toISOString()
    };
    
    return NextResponse.json({
      ok: true,
      batch: batchStatus,
      records: trainingRecords,
      totalAgents: trainingRecords.length,
      totalMemories: trainingRecords.reduce((sum, record) => sum + record.totalMemories, 0),
      totalFeedEvents: trainingRecords.reduce((sum, record) => sum + record.totalFeedEvents, 0)
    });
  } catch (error) {
    console.error('Error getting training records:', error);
    return NextResponse.json(
      { error: 'Failed to get training records' },
      { status: 500 }
    );
  }
}
