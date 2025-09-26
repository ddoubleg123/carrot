import { NextRequest, NextResponse } from 'next/server';
import AgentSelector, { SelectionCriteria } from '@/lib/ai-agents/agentSelector';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/agents/select - Select agents based on query and criteria
export async function POST(req: Request, _ctx: { params: Promise<{}> }) {
  try {
    const body = await req.json();
    const {
      query,
      maxAgents = 3,
      minScore = 0.3,
      requiredExpertise = [],
      excludeAgents = [],
      context = '',
      operation = 'select'
    } = body;

    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    const criteria: SelectionCriteria = {
      query,
      maxAgents,
      minScore,
      requiredExpertise,
      excludeAgents,
      context,
    };

    let results;

    switch (operation) {
      case 'select':
        results = await AgentSelector.selectAgents(criteria);
        break;

      case 'query':
        results = await AgentSelector.getAgentsForQuery(query, maxAgents);
        break;

      case 'expertise':
        if (!requiredExpertise || requiredExpertise.length === 0) {
          return NextResponse.json(
            { error: 'requiredExpertise is required for expertise operation' },
            { status: 400 }
          );
        }
        results = await AgentSelector.getAgentsByExpertise(requiredExpertise, maxAgents);
        break;

      case 'context':
        if (!context) {
          return NextResponse.json(
            { error: 'context is required for context operation' },
            { status: 400 }
          );
        }
        results = await AgentSelector.getAgentsForContext(context, query, maxAgents);
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid operation. Use "select", "query", "expertise", or "context"' },
          { status: 400 }
        );
    }

    return NextResponse.json({ 
      agents: results,
      total: results.length,
      criteria: {
        query,
        maxAgents,
        minScore,
        operation,
      }
    });
  } catch (error) {
    console.error('Error selecting agents:', error);
    return NextResponse.json(
      { error: 'Failed to select agents' },
      { status: 500 }
    );
  }
}
