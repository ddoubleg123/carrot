import { NextResponse } from 'next/server';
import { TrainingStore } from '@/lib/ai-agents/trainingStore';
import { FeedService } from '@/lib/ai-agents/feedService';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/agents/debug/feeding-status - Debug feeding issues
export async function GET(req: Request) {
  const url = new URL(req.url);
  const planId = url.searchParams.get('planId');
  const agentId = url.searchParams.get('agentId');

  if (!planId || !agentId) {
    return NextResponse.json({ 
      ok: false, 
      message: 'planId and agentId are required' 
    }, { status: 400 });
  }

  try {
    const plan = TrainingStore.getPlan(planId);
    if (!plan) {
      return NextResponse.json({ 
        ok: false, 
        message: 'Plan not found' 
      }, { status: 404 });
    }

    // Get agent info
    let agent;
    try {
      agent = await prisma.agent.findUnique({
        where: { id: agentId }
      });
    } catch (error) {
      console.error('[Debug] Error fetching agent:', error);
    }

    // Get agent memories count
    let memoriesCount = 0;
    try {
      memoriesCount = await prisma.agentMemory.count({
        where: { agentId }
      });
    } catch (error) {
      console.error('[Debug] Error counting memories:', error);
    }

    // Get recent memories
    let recentMemories: any[] = [];
    try {
      recentMemories = await FeedService.getRecentMemories(agentId, 10);
    } catch (error) {
      console.error('[Debug] Error fetching recent memories:', error);
    }

    // Get tasks for this plan
    const tasks = TrainingStore.listTasks(planId);
    const taskStats = {
      total: tasks.length,
      queued: tasks.filter(t => t.status === 'queued').length,
      running: tasks.filter(t => t.status === 'running').length,
      done: tasks.filter(t => t.status === 'done').length,
      failed: tasks.filter(t => t.status === 'failed').length,
      totalFed: tasks.reduce((sum, t) => sum + (t.itemsFed || 0), 0)
    };

    // Get discoveries
    const discoveries = TrainingStore.listDiscoveries(planId, { limit: 100 });
    const discoveryStats = {
      total: discoveries.length,
      retrieved: discoveries.filter(d => d.status === 'retrieved').length,
      fed: discoveries.filter(d => d.status === 'fed').length,
      failed: discoveries.filter(d => d.status === 'failed').length
    };

    // Check if agent exists in database
    const agentExists = !!agent;

    // Test a simple feed operation
    let testFeedResult = null;
    try {
      const testFeedItem = {
        content: 'Test content for debugging feeding system',
        sourceType: 'manual' as const,
        sourceTitle: 'Debug Test',
        sourceUrl: 'http://debug.test',
        tags: ['debug']
      };
      
      testFeedResult = await FeedService.feedAgent(agentId, testFeedItem, 'debug-test');
    } catch (error) {
      testFeedResult = {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : null,
        errorCode: (error as any)?.code,
        errorMeta: (error as any)?.meta
      };
    }

    // Check if agent exists in featured agents
    let featuredAgentInfo = null;
    try {
      const { FEATURED_AGENTS } = await import('@/lib/agents');
      featuredAgentInfo = FEATURED_AGENTS.find(a => a.id === agentId) || null;
    } catch (error) {
      console.error('[Debug] Error checking featured agents:', error);
    }

    // Try to get recent feeding attempts from logs (if possible)
    let recentFeedingAttempts: any[] = [];
    try {
      // This would be populated by actual log parsing if available
      recentFeedingAttempts = [
        { message: 'Check server logs for recent feeding attempts' }
      ];
    } catch (error) {
      console.error('[Debug] Error getting feeding attempts:', error);
    }

    return NextResponse.json({
      ok: true,
      debug: {
        planId,
        agentId,
        agentExists,
        agent: agent ? {
          id: agent.id,
          name: agent.name,
          domainExpertise: agent.domainExpertise,
          createdAt: agent.createdAt
        } : null,
        memoriesCount,
        recentMemories: recentMemories.slice(0, 5).map((m: any) => ({
          id: m.id,
          sourceTitle: m.sourceTitle,
          sourceUrl: m.sourceUrl,
          createdAt: m.createdAt
        })),
        plan: {
          id: plan.id,
          status: plan.status,
          topics: plan.topics,
          totals: plan.totals,
          options: plan.options
        },
        taskStats,
        discoveryStats,
        testFeedResult,
        featuredAgentInfo: featuredAgentInfo ? {
          id: featuredAgentInfo.id,
          name: featuredAgentInfo.name,
          domains: featuredAgentInfo.domains
        } : null,
        recentFeedingAttempts,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[Debug Feeding Status] Error:', error);
    return NextResponse.json({
      ok: false,
      message: 'Debug failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : null
    }, { status: 500 });
  }
}
