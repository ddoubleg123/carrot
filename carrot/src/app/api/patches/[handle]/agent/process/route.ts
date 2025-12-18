/**
 * Agent Feed Process Endpoint
 * 
 * POST /api/patches/[handle]/agent/process
 * Processes pending queue items for a specific patch
 * Can be called by cron jobs or scheduled tasks
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { processFeedQueue } from '@/lib/agent/feedWorker'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  try {
    const { handle } = await params
    const body = await request.json().catch(() => ({}))
    const batchSize = body.batchSize ? parseInt(body.batchSize) : 10

    // Get patch
    const patch = await prisma.patch.findUnique({
      where: { handle },
      select: { id: true, title: true }
    })

    if (!patch) {
      return NextResponse.json(
        { error: 'Patch not found' },
        { status: 404 }
      )
    }

    // Process queue for this patch
    const result = await processFeedQueue({
      patchId: patch.id,
      limit: batchSize
    })

    return NextResponse.json({
      success: true,
      patch: patch.title,
      processed: result.processed,
      failed: result.failed,
      skipped: result.skipped,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('[AgentProcess] Error:', error)
    return NextResponse.json(
      { error: 'Failed to process queue', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

/**
 * GET /api/patches/[handle]/agent/process
 * Get processing status
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  try {
    const { handle } = await params

    const patch = await prisma.patch.findUnique({
      where: { handle },
      select: { id: true, title: true }
    })

    if (!patch) {
      return NextResponse.json(
        { error: 'Patch not found' },
        { status: 404 }
      )
    }

    // Get queue stats
    const queueStats = await (prisma as any).agentMemoryFeedQueue.groupBy({
      by: ['status'],
      where: { patchId: patch.id },
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

    return NextResponse.json({
      patch: patch.title,
      queue: stats,
      total: Object.values(stats).reduce((a, b) => a + b, 0),
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('[AgentProcess] Error:', error)
    return NextResponse.json(
      { error: 'Failed to get status' },
      { status: 500 }
    )
  }
}

