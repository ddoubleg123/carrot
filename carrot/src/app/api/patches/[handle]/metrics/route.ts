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
    const [totalSources, totalHeroesResult, sourcesWithTextResult] = await Promise.all([
      prisma.discoveredContent.count({
        where: { patchId: patch.id }
      }),
      // Query heroes via raw SQL since Prisma relation query might have issues
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count
        FROM heroes h
        INNER JOIN discovered_content dc ON h.content_id = dc.id
        WHERE dc.patch_id = ${patch.id}
        AND h.status = 'READY'
      `.then(r => Number(r[0]?.count || 0)).catch(() => 0),
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count
        FROM discovered_content
        WHERE patch_id = ${patch.id}
        AND text_content IS NOT NULL
        AND text_content != ''
      `.then(r => Number(r[0]?.count || 0)).catch(() => 0)
    ])
    
    const totalHeroes = Number(totalHeroesResult || 0)
    const sourcesWithText = Number(sourcesWithTextResult || 0)
    
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
    
    // Get run metrics snapshot for more detailed counters
    const { getRunMetricsSnapshot } = await import('@/lib/redis/discovery')
    const runMetrics = await getRunMetricsSnapshot(patch.id).catch(() => null)
    
    // Count render_ok from metadata (using raw query since Prisma JSON filtering is limited)
    const sourcesWithRenderResult = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count
      FROM discovered_content
      WHERE patch_id = ${patch.id}
      AND metadata::jsonb->>'renderUsed' = 'true'
    `.catch(() => [{ count: BigInt(0) }])
    const sourcesWithRender = Number(sourcesWithRenderResult[0]?.count || 0)
    
    // Extract metrics from runMetrics snapshot (if available)
    const runMetricsData = runMetrics as any
    const processedCount = runMetricsData?.candidatesProcessed || runMetricsData?.processed || counters.total || 0
    const duplicatesCount = runMetricsData?.duplicates || 0
    const paywallCount = runMetricsData?.paywall || runMetricsData?.paywallBlocked || 0
    
    return NextResponse.json({
      success: true,
      patchId: patch.id,
      patchHandle: handle,
      metrics: {
        processed: processedCount,
        saved: totalSources,
        duplicates: duplicatesCount,
        paywallBlocked: paywallCount,
        extractOk: sourcesWithText,
        renderOk: sourcesWithRender,
        persistOk: totalSources, // All saved items are persisted
        relevanceFail: runMetricsData?.relevanceFail || 0,
        skipped: runMetricsData?.skipped || 0
      },
      counters: {
        processed: processedCount,
        saved: totalSources,
        heroes: totalHeroes,
        deduped: duplicatesCount,
        paywall: paywallCount,
        extractOk: sourcesWithText,
        renderOk: sourcesWithRender,
        promoted: totalHeroes
      },
      runState: runState ? {
        isActive: runState === 'live',
        status: runState,
        runId: null // TODO: get runId from Redis if needed
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

