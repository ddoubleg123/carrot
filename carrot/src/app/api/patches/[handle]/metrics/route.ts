import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSaveCounters, getRunState } from '@/lib/redis/discovery'
import { z } from 'zod'

/**
 * GET /api/patches/[handle]/metrics
 * Returns discovery metrics for a patch
 * Never throws - always returns 200 with success/error status
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MetricsResponseSchema = z.object({
  success: z.boolean(),
  patchId: z.string().optional(),
  patchHandle: z.string().optional(),
  message: z.string().optional(),
  details: z.string().optional(),
  metrics: z.object({
    processed: z.number(),
    saved: z.number(),
    duplicates: z.number(),
    paywallBlocked: z.number(),
    extractOk: z.number(),
    renderOk: z.number(),
    persistOk: z.number(),
    relevanceFail: z.number(),
    skipped: z.number()
  }).optional(),
  counters: z.object({
    processed: z.number(),
    saved: z.number(),
    heroes: z.number(),
    deduped: z.number(),
    paywall: z.number(),
    extractOk: z.number(),
    renderOk: z.number(),
    promoted: z.number()
  }).optional(),
  runState: z.object({
    isActive: z.boolean(),
    status: z.string(),
    runId: z.string().nullable()
  }).nullable().optional(),
  recentRun: z.object({
    id: z.string(),
    status: z.string(),
    metrics: z.any().nullable(),
    createdAt: z.date().nullable().optional(),
    startedAt: z.date(),
    completedAt: z.date().nullable().optional()
  }).nullable().optional()
})

type MetricsResponse = z.infer<typeof MetricsResponseSchema>

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  let handle: string
  try {
    const resolved = await params
    handle = resolved.handle
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: 'Invalid request parameters',
      details: error instanceof Error ? error.message : 'Unknown error'
    } as MetricsResponse, { status: 200 })
  }
  
  try {
    const patch = await prisma.patch.findUnique({
      where: { handle },
      select: { id: true }
    })
    
    if (!patch) {
      return NextResponse.json({
        success: false,
        message: 'Patch not found',
        patchHandle: handle
      } as MetricsResponse, { status: 200 })
    }
    
    // Get Redis counters with error handling
    const counters = await getSaveCounters(patch.id).catch(() => ({
      total: 0,
      controversy: 0,
      history: 0
    }))
    
    // Get run state with error handling
    const runState = await getRunState(patch.id).catch(() => null)
    
    // Get DB counts with individual error handling
    let totalSources = 0
    let totalHeroes = 0
    let sourcesWithText = 0
    let sourcesWithRender = 0
    
    try {
      totalSources = await prisma.discoveredContent.count({
        where: { patchId: patch.id }
      })
    } catch (error) {
      console.error('[Metrics API] Error counting sources:', error)
    }
    
    try {
      const totalHeroesResult = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count
        FROM heroes h
        INNER JOIN discovered_content dc ON h.content_id = dc.id
        WHERE dc.patch_id = ${patch.id}
        AND h.status = 'READY'
      `
      totalHeroes = Number(totalHeroesResult[0]?.count || 0)
    } catch (error) {
      console.error('[Metrics API] Error counting heroes:', error)
    }
    
    try {
      const sourcesWithTextResult = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count
        FROM discovered_content
        WHERE patch_id = ${patch.id}
        AND text_content IS NOT NULL
        AND text_content != ''
      `
      sourcesWithText = Number(sourcesWithTextResult[0]?.count || 0)
    } catch (error) {
      console.error('[Metrics API] Error counting sources with text:', error)
    }
    
    try {
      const sourcesWithRenderResult = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count
        FROM discovered_content
        WHERE patch_id = ${patch.id}
        AND metadata::jsonb->>'renderUsed' = 'true'
      `
      sourcesWithRender = Number(sourcesWithRenderResult[0]?.count || 0)
    } catch (error) {
      console.error('[Metrics API] Error counting sources with render:', error)
    }
    
    // Get recent run metrics - use startedAt instead of createdAt
    let recentRun = null
    try {
      recentRun = await (prisma as any).discoveryRun.findFirst({
        where: { patchId: patch.id },
        orderBy: { startedAt: 'desc' }, // Fixed: use startedAt instead of createdAt
        select: {
          id: true,
          status: true,
          metrics: true,
          startedAt: true,
          endedAt: true
        }
      })
    } catch (error) {
      console.error('[Metrics API] Error fetching recent run:', error)
    }
    
    // Get run metrics snapshot for more detailed counters
    let runMetrics = null
    try {
      const { getRunMetricsSnapshot } = await import('@/lib/redis/discovery')
      runMetrics = await getRunMetricsSnapshot(patch.id).catch(() => null)
    } catch (error) {
      console.error('[Metrics API] Error fetching run metrics snapshot:', error)
    }
    
    // Extract metrics from runMetrics snapshot (if available)
    const runMetricsData = runMetrics as any
    const processedCount = runMetricsData?.candidatesProcessed || runMetricsData?.processed || counters.total || 0
    const duplicatesCount = runMetricsData?.duplicates || 0
    const paywallCount = runMetricsData?.paywall || runMetricsData?.paywallBlocked || 0
    
    const response: MetricsResponse = {
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
        persistOk: totalSources,
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
        runId: null
      } : null,
      recentRun: recentRun ? {
        id: recentRun.id,
        status: recentRun.status,
        metrics: recentRun.metrics,
        startedAt: recentRun.startedAt,
        completedAt: recentRun.endedAt || null
      } : null
    }
    
    // Validate response with Zod
    const validated = MetricsResponseSchema.parse(response)
    
    return NextResponse.json(validated, { status: 200 })
  } catch (error) {
    console.error('[Metrics API] Error:', error)
    // Always return 200, never 500
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch metrics',
      details: error instanceof Error ? error.message : 'Unknown error',
      metrics: {
        processed: 0,
        saved: 0,
        duplicates: 0,
        paywallBlocked: 0,
        extractOk: 0,
        renderOk: 0,
        persistOk: 0,
        relevanceFail: 0,
        skipped: 0
      },
      counters: {
        processed: 0,
        saved: 0,
        heroes: 0,
        deduped: 0,
        paywall: 0,
        extractOk: 0,
        renderOk: 0,
        promoted: 0
      }
    } as MetricsResponse, { status: 200 })
  }
}

