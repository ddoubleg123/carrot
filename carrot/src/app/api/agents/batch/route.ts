import { NextRequest, NextResponse } from 'next/server';
import BatchProcessor from '@/lib/ai-agents/batchProcessor';
import { FeedItem } from '@/lib/ai-agents/feedService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/agents/batch - Process batch feed operations
export async function POST(req: Request, _ctx: { params: Promise<{}> }) {
  try {
    // Check if we're on Render and what tier
    const isRender = process.env.RENDER === 'true' || process.env.NODE_ENV === 'production';
    const isRenderFreeTier = isRender && (!process.env.RENDER_SERVICE_ID || process.env.RENDER_SERVICE_ID.includes('free'));
    
    // Check memory limit - paid Render plans have more memory
    const memUsage = process.memoryUsage();
    const memUsageMB = memUsage.heapUsed / 1024 / 1024;
    const totalMemMB = memUsage.heapTotal / 1024 / 1024;
    
    console.log(`[Batch API] Server info: Render=${isRender}, FreeTier=${isRenderFreeTier}, Memory=${memUsageMB.toFixed(2)}MB/${totalMemMB.toFixed(2)}MB`);
    
    // Only disable on free tier or if memory is very low
    if (isRenderFreeTier || (isRender && totalMemMB < 1000)) {
      console.log('[Batch API] AI training disabled on Render free tier - returning mock response');
      return NextResponse.json({
        results: {
          message: 'AI agent training is disabled on the free tier due to memory limitations.',
          suggestion: 'For full AI training capabilities, please run locally or upgrade to a paid server with more memory.',
          mockResults: true,
          serverInfo: {
            isRender,
            isFreeTier: isRenderFreeTier,
            memoryUsage: `${memUsageMB.toFixed(2)}MB`,
            totalMemory: `${totalMemMB.toFixed(2)}MB`
          }
        }
      });
    }

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

        // Limit number of agents to prevent memory issues
        const MAX_AGENTS = 10;
        if (agentIds.length > MAX_AGENTS) {
          return NextResponse.json(
            { 
              error: `Too many agents. Maximum ${MAX_AGENTS} agents allowed per batch.`,
              provided: agentIds.length,
              maxAllowed: MAX_AGENTS
            },
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
