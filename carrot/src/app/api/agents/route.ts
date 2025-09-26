import { NextRequest, NextResponse } from 'next/server';
import AgentRegistry, { CreateAgentData } from '@/lib/ai-agents/agentRegistry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/agents - Get all agents
export async function GET(req: Request, _ctx: { params: Promise<{}> }) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q');
    const expertise = searchParams.get('expertise');
    const patches = searchParams.get('patches');

    let agents;

    if (query) {
      agents = await AgentRegistry.searchAgents(query);
    } else if (expertise) {
      agents = await AgentRegistry.getAgentsByExpertise(expertise.split(','));
    } else if (patches) {
      agents = await AgentRegistry.getAgentsByPatches(patches.split(','));
    } else {
      agents = await AgentRegistry.getAllAgents();
    }

    return NextResponse.json({ agents });
  } catch (error) {
    console.error('Error fetching agents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agents' },
      { status: 500 }
    );
  }
}

// POST /api/agents - Create new agent
export async function POST(req: Request, _ctx: { params: Promise<{}> }) {
  try {
    const body = await req.json();
    const agentData: CreateAgentData = {
      name: body.name,
      persona: body.persona,
      domainExpertise: body.domainExpertise || [],
      associatedPatches: body.associatedPatches || [],
      vectorDbRef: body.vectorDbRef,
      knowledgeProfile: body.knowledgeProfile,
      feedSubscriptions: body.feedSubscriptions,
      metadata: body.metadata || {},
    };

    // Validate required fields
    if (!agentData.name || !agentData.persona) {
      return NextResponse.json(
        { error: 'Name and persona are required' },
        { status: 400 }
      );
    }

    const agent = await AgentRegistry.createAgent(agentData);

    return NextResponse.json({ agent }, { status: 201 });
  } catch (error) {
    console.error('Error creating agent:', error);
    return NextResponse.json(
      { error: 'Failed to create agent' },
      { status: 500 }
    );
  }
}
