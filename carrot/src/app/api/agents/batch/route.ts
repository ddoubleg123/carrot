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
    
    // For now, disable AI training on all Render deployments due to memory constraints
    // Even paid plans are having issues with the current AI training implementation
    if (isRender) {
      console.log('[Batch API] AI training disabled on Render - returning mock response');
      return NextResponse.json({
        results: {
          message: 'AI agent training is temporarily disabled on Render due to memory constraints.',
          suggestion: 'The AI training system requires more memory than available on current Render plans. Consider running locally for full functionality.',
          mockResults: true,
          serverInfo: {
            isRender,
            isFreeTier: isRenderFreeTier,
            memoryUsage: `${memUsageMB.toFixed(2)}MB`,
            totalMemory: `${totalMemMB.toFixed(2)}MB`,
            plan: isRenderFreeTier ? 'Free' : 'Paid'
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

        // Add timeout to prevent server crashes
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout - AI training took too long')), 30000); // 30 second timeout
        });
        
        try {
          results = await Promise.race([
            BatchProcessor.processMultiAgentFeed(agentIds, feedItem),
            timeoutPromise
          ]);
        } catch (error) {
          console.error('[Batch API] Error processing multi-agent feed:', error);
          return NextResponse.json({
            results: {
              message: 'AI training failed due to server limitations. The training process is too resource-intensive for the current server configuration.',
              suggestion: 'Try training one agent at a time or use a more powerful server.',
              mockResults: true,
              error: error.message,
              serverInfo: {
                isRender,
                isFreeTier: isRenderFreeTier,
                memoryUsage: `${memUsageMB.toFixed(2)}MB`,
                totalMemory: `${totalMemMB.toFixed(2)}MB`
              }
            }
          }, { status: 503 });
        }
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
