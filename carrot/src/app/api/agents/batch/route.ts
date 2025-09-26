import { NextRequest, NextResponse } from 'next/server';
import BatchProcessor from '@/lib/ai-agents/batchProcessor';
import { FeedItem } from '@/lib/ai-agents/feedService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/agents/batch - Process batch feed operations
export async function POST(req: Request, _ctx: { params: Promise<{}> }) {
  try {
    const body = await req.json();
    const { 
      agentIds, 
      feedItem, 
      content, 
      sourceType, 
      expertiseTags,
      operation = 'feed' 
    } = body;

    let results;

    switch (operation) {
      case 'feed':
        if (!agentIds || !Array.isArray(agentIds) || agentIds.length === 0) {
          return NextResponse.json(
            { error: 'agentIds array is required' },
            { status: 400 }
          );
        }

        if (!feedItem) {
          return NextResponse.json(
            { error: 'feedItem is required' },
            { status: 400 }
          );
        }

        results = await BatchProcessor.processMultiAgentFeed(agentIds, feedItem);
        break;

      case 'expertise':
        if (!content || !sourceType) {
          return NextResponse.json(
            { error: 'content and sourceType are required' },
            { status: 400 }
          );
        }

        results = await BatchProcessor.processByExpertise(content, sourceType, expertiseTags);
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid operation. Use "feed" or "expertise"' },
          { status: 400 }
        );
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Error processing batch operation:', error);
    
    // Provide more detailed error information
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    return NextResponse.json(
      { 
        error: 'Failed to process batch operation',
        details: errorMessage,
        stack: process.env.NODE_ENV === 'development' ? errorStack : undefined
      },
      { status: 500 }
    );
  }
}
