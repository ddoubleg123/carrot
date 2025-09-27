import { NextResponse } from 'next/server';
import BatchProcessor from '@/lib/ai-agents/batchProcessor';
import { FeedService, FeedItem } from '@/lib/ai-agents/feedService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/agents/batch - Process batch feed operations
export async function POST(request: Request, _context: { params: Promise<{}> }) {
  try {
    // Check if we're on Render and what tier
    const isRender = process.env.RENDER === 'true' || process.env.NODE_ENV === 'production';
    const isRenderFreeTier = isRender && (!process.env.RENDER_SERVICE_ID || process.env.RENDER_SERVICE_ID.includes('free'));
    
    // Check memory limit - paid Render plans have more memory
    const memUsage = process.memoryUsage();
    const memUsageMB = memUsage.heapUsed / 1024 / 1024;
    const totalMemMB = memUsage.heapTotal / 1024 / 1024;
    
    console.log(`[Batch API] Server info: Render=${isRender}, FreeTier=${isRenderFreeTier}, Memory=${memUsageMB.toFixed(2)}MB/${totalMemMB.toFixed(2)}MB`);
    
    // Check memory usage and warn if high, but don't disable
    if (memUsageMB > 800) { // Warn if using more than 800MB
      console.warn(`[Batch API] High memory usage detected: ${memUsageMB.toFixed(2)}MB/${totalMemMB.toFixed(2)}MB`);
    }

    const body = await request.json();
    const { 
      agentIds, 
      feedItem, 
      content, 
      sourceType, 
      expertiseTags,
      operation = 'feed' 
    } = body;

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

        try {
          // Process agents one at a time to avoid memory issues
          const results = [];
          for (const agentId of agentIds) {
            try {
              console.log(`[Batch API] Processing agent ${agentId}...`);
              const result = await FeedService.feedAgent(agentId, feedItem);
              results.push({
                agentId,
                success: true,
                memoriesCreated: result.memoryIds.length,
                memoryIds: result.memoryIds
              });
            } catch (agentError) {
              console.error(`[Batch API] Error processing agent ${agentId}:`, agentError);
              results.push({
                agentId,
                success: false,
                error: agentError instanceof Error ? agentError.message : String(agentError),
                memoriesCreated: 0,
                memoryIds: []
              });
            }
          }
          
          return NextResponse.json({
            results: {
              message: `Processed ${agentIds.length} agents`,
              totalAgents: agentIds.length,
              successfulAgents: results.filter(r => r.success).length,
              failedAgents: results.filter(r => !r.success).length,
              results
            }
          });
        } catch (error) {
          console.error('[Batch API] Error processing batch feed:', error);
          return NextResponse.json({
            results: {
              message: 'AI training failed due to server limitations.',
              suggestion: 'Try training one agent at a time or use a more powerful server.',
              mockResults: true,
              error: error instanceof Error ? error.message : String(error),
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

        const expertiseResults = await BatchProcessor.processByExpertise(content, sourceType, expertiseTags);
        return NextResponse.json({ results: expertiseResults });

      default:
        return NextResponse.json(
          { error: 'Invalid operation. Use "feed" or "expertise"' },
          { status: 400 }
        );
    }
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
