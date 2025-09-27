import { NextRequest, NextResponse } from 'next/server';
import { AgentSpecificRetriever } from '@/lib/ai-agents/agentSpecificRetriever';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/agents/training-records - Get training records for all agents
export async function GET(req: Request) {
  try {
    const trainingRecords = await AgentSpecificRetriever.getAllTrainingRecords();
    
    return NextResponse.json({
      success: true,
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
