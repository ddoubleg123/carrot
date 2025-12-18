/**
 * Process All Agent Feed Queues
 * 
 * POST /api/agent-feed/process-all
 * Processes pending queue items for ALL patches
 * Designed to be called by cron jobs or scheduled tasks
 * No authentication required (internal endpoint)
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { processFeedQueue } from '@/lib/agent/feedWorker'

export const dynamic = 'force-dynamic'
export const maxDuration = 600 // 10 minutes

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const batchSize = body.batchSize ? parseInt(body.batchSize) : 20
    const maxPatches = body.maxPatches ? parseInt(body.maxPatches) : undefined

    // Get all patches with pending queue items
    const patchesWithQueue = await (prisma as any).agentMemoryFeedQueue.findMany({
      where: { status: 'PENDING' },
      select: {
        patchId: true
      },
      distinct: ['patchId'],
      ...(maxPatches ? { take: maxPatches } : {})
    })

    const patchIds: string[] = Array.from(new Set(patchesWithQueue.map((q: any) => String(q.patchId))))

    const results = []
    let totalProcessed = 0
    let totalFailed = 0
    let totalSkipped = 0

    // Process each patch
    for (const patchId of patchIds) {
      try {
        const result = await processFeedQueue({
          patchId,
          limit: batchSize
        })

        totalProcessed += result.processed
        totalFailed += result.failed
        totalSkipped += result.skipped

        results.push({
          patchId,
          processed: result.processed,
          failed: result.failed,
          skipped: result.skipped
        })
      } catch (error) {
        console.error(`[ProcessAll] Error processing patch ${patchId}:`, error)
        results.push({
          patchId,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }

    return NextResponse.json({
      success: true,
      patchesProcessed: patchIds.length,
      total: {
        processed: totalProcessed,
        failed: totalFailed,
        skipped: totalSkipped
      },
      results,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('[ProcessAll] Error:', error)
    return NextResponse.json(
      { error: 'Failed to process queues', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

/**
 * GET /api/agent-feed/process-all
 * Get overall processing status
 */
export async function GET() {
  try {
    // Get overall queue stats
    const queueStats = await (prisma as any).agentMemoryFeedQueue.groupBy({
      by: ['status'],
      _count: true
    })

    const stats = {
      PENDING: 0,
      PROCESSING: 0,
      DONE: 0,
      FAILED: 0
    }

    for (const stat of queueStats) {
      stats[stat.status as keyof typeof stats] = stat._count
    }

    // Get patches with pending items
    const patchesWithPending = await (prisma as any).agentMemoryFeedQueue.findMany({
      where: { status: 'PENDING' },
      select: { patchId: true },
      distinct: ['patchId']
    })

    return NextResponse.json({
      queue: stats,
      total: Object.values(stats).reduce((a, b) => a + b, 0),
      patchesWithPending: patchesWithPending.length,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('[ProcessAll] Error:', error)
    return NextResponse.json(
      { error: 'Failed to get status' },
      { status: 500 }
    )
  }
}

