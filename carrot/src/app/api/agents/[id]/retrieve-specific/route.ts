import { NextRequest, NextResponse } from 'next/server';
import { AgentSpecificRetriever } from '@/lib/ai-agents/agentSpecificRetriever';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/agents/[id]/retrieve-specific - Get agent-specific content
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { 
      maxResults = 5,
      autoFeed = false,
      sourceTypes = ['wikipedia', 'arxiv'],
      openAccessOnly = false
    } = body;

    const result = await AgentSpecificRetriever.retrieveForAgent({
      agentId: id,
      maxResults,
      autoFeed,
      sourceTypes,
      openAccessOnly
    });

    return NextResponse.json({
      success: result.success,
      agentId: id,
      results: result.results,
      trainingRecord: result.trainingRecord,
      message: result.success 
        ? `Retrieved ${result.results.length} pieces of agent-specific content`
        : 'Failed to retrieve agent-specific content'
    });
  } catch (error) {
    console.error('Error in agent-specific retrieval:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve agent-specific content' },
      { status: 500 }
    );
  }
}

// GET /api/agents/[id]/retrieve-specific - Get agent training record
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const trainingRecord = await AgentSpecificRetriever.getAgentTrainingRecord(id);
    
    return NextResponse.json({
      success: true,
      trainingRecord
    });
  } catch (error) {
    console.error('Error getting training record:', error);
    return NextResponse.json(
      { error: 'Failed to get training record' },
      { status: 500 }
    );
  }
}
