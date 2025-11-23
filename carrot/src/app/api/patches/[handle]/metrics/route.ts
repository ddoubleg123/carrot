import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSaveCounters, getRunState } from '@/lib/redis/discovery'

/**
 * GET /api/patches/[handle]/metrics
 * Returns discovery metrics for a patch
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  try {
    const { handle } = await params
    
    const patch = await prisma.patch.findUnique({
      where: { handle },
      select: { id: true }
    })
    
    if (!patch) {
      return NextResponse.json({ error: 'Patch not found' }, { status: 404 })
    }
    
    // Get Redis counters
    const counters = await getSaveCounters(patch.id).catch(() => ({
      total: 0,
      controversy: 0,
      history: 0
    }))
    
    // Get run state
    const runState = await getRunState(patch.id).catch(() => null)
    
    // Get DB counts
    const [totalSources, totalHeroes, sourcesWithText] = await Promise.all([
      prisma.discoveredContent.count({
        where: { patchId: patch.id }
      }),
      prisma.hero.count({
        where: { 
          content: { patchId: patch.id },
          status: 'READY'
        }
      }),
      prisma.discoveredContent.count({
        where: {
          patchId: patch.id,
          textContent: { not: null },
          NOT: { textContent: '' }
        }
      })
    ])
    
    // Get recent run metrics
    const recentRun = await (prisma as any).discoveryRun.findFirst({
      where: { patchId: patch.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        metrics: true,
        createdAt: true,
        startedAt: true,
        completedAt: true
      }
    })
    
    return NextResponse.json({
      success: true,
      patchId: patch.id,
      patchHandle: handle,
      counters: {
        processed: counters.total || 0,
        saved: totalSources,
        heroes: totalHeroes,
        deduped: 0, // TODO: track in Redis
        paywall: 0, // TODO: track in Redis
        extractOk: sourcesWithText,
        renderOk: 0, // TODO: track in Redis
        promoted: totalHeroes
      },
      runState: runState ? {
        isActive: runState.status === 'live',
        status: runState.status,
        runId: runState.runId
      } : null,
      recentRun: recentRun ? {
        id: recentRun.id,
        status: recentRun.status,
        metrics: recentRun.metrics,
        createdAt: recentRun.createdAt,
        startedAt: recentRun.startedAt,
        completedAt: recentRun.completedAt
      } : null
    })
  } catch (error) {
    console.error('[Metrics API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

