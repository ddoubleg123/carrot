import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSaveCounters } from '@/lib/redis/discovery'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Get discovery metrics for a patch
 * GET /api/patches/[handle]/discover-metrics
 * 
 * Returns:
 * - processed: Total items processed (from Redis counters)
 * - saved: Actual DB count
 * - duplicates: Duplicate count
 * - paywallBlocked: Paywall blocked count
 * - extractOk: Successful extractions
 * - relevanceFail: Relevance failures
 * - persistOk: Successful persists
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ handle: string }> }
) {
  try {
    const { handle } = await params
    
    // Find patch
    const patch = await prisma.patch.findUnique({
      where: { handle },
      select: { id: true }
    })
    
    if (!patch) {
      return NextResponse.json({ error: 'Patch not found' }, { status: 404 })
    }
    
    // Get actual DB count
    const savedCount = await prisma.discoveredContent.count({
      where: { patchId: patch.id }
    })
    
    // Get telemetry metrics (if available)
    let telemetryMetrics
    try {
      const { DiscoveryTelemetry } = await import('@/lib/discovery/telemetry')
      telemetryMetrics = await DiscoveryTelemetry.getAggregatedTelemetry(patch.id)
    } catch (err) {
      console.warn('[Discover Metrics] Failed to get telemetry:', err)
      telemetryMetrics = null
    }
    
    // Get Redis counters (if available) - legacy
    let redisCounters
    try {
      redisCounters = await getSaveCounters(patch.id)
    } catch (err) {
      console.warn('[Discover Metrics] Failed to get Redis counters:', err)
      redisCounters = null
    }
    
    // Get frontier stats
    let frontierStats
    try {
      const { getFrontierStats } = await import('@/lib/discovery/crawlFrontier')
      frontierStats = await getFrontierStats()
    } catch (err) {
      console.warn('[Discover Metrics] Failed to get frontier stats:', err)
      frontierStats = null
    }
    
    return NextResponse.json({
      success: true,
      patchId: patch.id,
      handle,
      metrics: {
        processed: telemetryMetrics?.processed || 0,
        saved: savedCount, // Actual DB count
        duplicates: telemetryMetrics?.duplicates || 0,
        paywallBlocked: telemetryMetrics?.paywallBlocked || 0,
        extractOk: telemetryMetrics?.extractOk || 0,
        relevanceFail: telemetryMetrics?.relevanceFail || 0,
        persistOk: telemetryMetrics?.persistOk || 0,
        skipped: telemetryMetrics?.skipped || 0
      },
      frontier: frontierStats || null,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('[Discover Metrics] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch metrics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

