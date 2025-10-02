import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { FeedService } from '@/lib/ai-agents/feedService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const agentId = url.searchParams.get('agentId');

  try {
    // Get all agents if no specific agent requested
    const agents = agentId 
      ? await prisma.agent.findMany({ where: { id: agentId } })
      : await prisma.agent.findMany({ take: 10 });

    const results = [];

    for (const agent of agents) {
      try {
        // Count memories
        const memoryCount = await prisma.agentMemory.count({
          where: { agentId: agent.id }
        });

        // Get recent memories
        const recentMemories = await prisma.agentMemory.findMany({
          where: { agentId: agent.id },
          orderBy: { createdAt: 'desc' },
          take: 3,
          select: {
            id: true,
            sourceTitle: true,
            sourceType: true,
            createdAt: true,
            fedBy: true
          }
        });

        // Count feed events
        const feedEventCount = await prisma.agentFeedEvent.count({
          where: { agentId: agent.id }
        });

        // Get recent feed events
        const recentFeedEvents = await prisma.agentFeedEvent.findMany({
          where: { agentId: agent.id },
          orderBy: { createdAt: 'desc' },
          take: 3,
          select: {
            id: true,
            eventType: true,
            sourceTitle: true,
            createdAt: true,
            fedBy: true
          }
        });

        // Test a simple feed operation
        let testFeedResult = null;
        try {
          const testFeedItem = {
            content: `Test content for debugging feeding system - ${new Date().toISOString()}`,
            sourceType: 'manual' as const,
            sourceTitle: 'Debug Test Feed',
            sourceUrl: 'http://debug.test',
            tags: ['debug', 'test']
          };
          
          testFeedResult = await FeedService.feedAgent(agent.id, testFeedItem, 'debug-test');
        } catch (error) {
          testFeedResult = {
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : 'N/A',
          };
        }

        results.push({
          agentId: agent.id,
          agentName: agent.name,
          memoryCount,
          recentMemories,
          feedEventCount,
          recentFeedEvents,
          testFeedResult
        });

      } catch (error) {
        results.push({
          agentId: agent.id,
          agentName: agent.name,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      results
    });

  } catch (error) {
    console.error('[Debug Agent Feeding] Error:', error);
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'N/A'
    }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { agentId, testContent } = body;

    if (!agentId) {
      return NextResponse.json({ ok: false, error: 'agentId required' }, { status: 400 });
    }

    const testFeedItem = {
      content: testContent || `Manual test feed - ${new Date().toISOString()}`,
      sourceType: 'manual' as const,
      sourceTitle: 'Manual Debug Test',
      sourceUrl: 'http://manual.debug.test',
      tags: ['manual', 'debug', 'test']
    };

    const result = await FeedService.feedAgent(agentId, testFeedItem, 'manual-debug');

    return NextResponse.json({
      ok: true,
      result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Debug Agent Feeding POST] Error:', error);
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'N/A'
    }, { status: 500 });
  }
}
