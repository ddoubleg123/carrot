import { NextRequest, NextResponse } from 'next/server';
import CarrotIntegration from '@/lib/ai-agents/carrotIntegration';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/agents/carrot/connect - Connect agents to Carrot content
export async function POST(req: Request, _ctx: { params: Promise<{}> }) {
  try {
    const body = await req.json();
    const { 
      patchId, 
      postId, 
      query, 
      maxAgents = 3,
      operation = 'patch' 
    } = body;

    let connections;

    switch (operation) {
      case 'patch':
        if (!patchId) {
          return NextResponse.json(
            { error: 'patchId is required for patch operation' },
            { status: 400 }
          );
        }
        connections = await CarrotIntegration.connectAgentsToPatch(patchId, query, maxAgents);
        break;

      case 'post':
        if (!postId) {
          return NextResponse.json(
            { error: 'postId is required for post operation' },
            { status: 400 }
          );
        }
        connections = await CarrotIntegration.connectAgentsToPost(postId, query, maxAgents);
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid operation. Use "patch" or "post"' },
          { status: 400 }
        );
    }

    return NextResponse.json({ connections });
  } catch (error) {
    console.error('Error connecting agents to Carrot content:', error);
    return NextResponse.json(
      { error: 'Failed to connect agents to Carrot content' },
      { status: 500 }
    );
  }
}
