import { NextRequest, NextResponse } from 'next/server';
import AgentRegistry, { UpdateAgentData } from '@/lib/ai-agents/agentRegistry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/agents/[id] - Get specific agent
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const agent = await AgentRegistry.getAgentById(id);

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ agent });
  } catch (error) {
    console.error('Error fetching agent:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agent' },
      { status: 500 }
    );
  }
}

// PUT /api/agents/[id] - Update agent
export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    
    const updateData: UpdateAgentData = {
      name: body.name,
      persona: body.persona,
      domainExpertise: body.domainExpertise,
      associatedPatches: body.associatedPatches,
      vectorDbRef: body.vectorDbRef,
      knowledgeProfile: body.knowledgeProfile,
      feedSubscriptions: body.feedSubscriptions,
      metadata: body.metadata,
      isActive: body.isActive,
    };

    const agent = await AgentRegistry.updateAgent(id, updateData);

    return NextResponse.json({ agent });
  } catch (error) {
    console.error('Error updating agent:', error);
    return NextResponse.json(
      { error: 'Failed to update agent' },
      { status: 500 }
    );
  }
}

// DELETE /api/agents/[id] - Deactivate agent
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const agent = await AgentRegistry.deactivateAgent(id);

    return NextResponse.json({ agent });
  } catch (error) {
    console.error('Error deactivating agent:', error);
    return NextResponse.json(
      { error: 'Failed to deactivate agent' },
      { status: 500 }
    );
  }
}
