import { NextRequest, NextResponse } from 'next/server';
import { ContentRetriever, RetrievalRequest } from '@/lib/ai-agents/contentRetriever';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/agents/retrieve - Automatically retrieve and feed content to agents
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      query, 
      sourceTypes = ['wikipedia'], 
      maxResults = 5, 
      agentIds,
      autoFeed = false 
    } = body;

    if (!query || !agentIds || !Array.isArray(agentIds) || agentIds.length === 0) {
      return NextResponse.json(
        { error: 'Query and agentIds array are required' },
        { status: 400 }
      );
    }

    const request: RetrievalRequest = {
      query,
      sourceTypes,
      maxResults,
      agentIds
    };

    if (autoFeed) {
      // Automatically retrieve and feed content
      const result = await ContentRetriever.autoFeedAgents(request);
      return NextResponse.json({ 
        success: result.success,
        results: result.results,
        message: `Retrieved and fed content to ${agentIds.length} agents`
      });
    } else {
      // Just retrieve content without feeding
      const retrievedContent = await ContentRetriever.retrieveContent(request);
      return NextResponse.json({ 
        success: true,
        content: retrievedContent,
        message: `Retrieved ${retrievedContent.length} pieces of content`
      });
    }
  } catch (error) {
    console.error('Error in content retrieval:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve content' },
      { status: 500 }
    );
  }
}
