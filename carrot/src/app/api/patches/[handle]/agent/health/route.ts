/**
 * Agent Feed Health Endpoint
 * 
 * GET /api/patches/[handle]/agent/health
 * Returns queue status, lag, and failure metrics
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  try {
    const { handle } = await params

    // Get patch
    const patch = await prisma.patch.findUnique({
      where: { handle },
      select: { id: true }
    })

    if (!patch) {
      return NextResponse.json(
        { error: 'Patch not found' },
        { status: 404 }
      )
    }

    // Get queue counts
    const [queued, processing, done, failed] = await Promise.all([
      prisma.agentMemoryFeedQueue.count({
        where: { patchId: patch.id, status: 'PENDING' }
      }),
      prisma.agentMemoryFeedQueue.count({
        where: { patchId: patch.id, status: 'PROCESSING' }
      }),
      prisma.agentMemoryFeedQueue.count({
        where: { patchId: patch.id, status: 'DONE' }
      }),
      prisma.agentMemoryFeedQueue.count({
        where: { patchId: patch.id, status: 'FAILED' }
      })
    ])

    // Calculate lag (p95 of pending items)
    const pendingItems = await prisma.agentMemoryFeedQueue.findMany({
      where: { patchId: patch.id, status: 'PENDING' },
      select: { enqueuedAt: true },
      orderBy: { enqueuedAt: 'asc' },
      take: 100
    })

    const now = Date.now()
    const lags = pendingItems.map(item => 
      (now - item.enqueuedAt.getTime()) / 1000
    ).sort((a, b) => a - b)

    const p95Lag = lags.length > 0
      ? lags[Math.floor(lags.length * 0.95)]
      : 0

    // Get last error sample
    const lastFailed = await prisma.agentMemoryFeedQueue.findFirst({
      where: { patchId: patch.id, status: 'FAILED' },
      select: { lastError: true, enqueuedAt: true },
      orderBy: { enqueuedAt: 'desc' }
    })

    // Get last processed item time
    const lastDone = await prisma.agentMemoryFeedQueue.findFirst({
      where: { patchId: patch.id, status: 'DONE' },
      select: { enqueuedAt: true },
      orderBy: { enqueuedAt: 'desc' }
    })

    // Get memory count
    const memoryCount = await prisma.agentMemory.count({
      where: { patchId: patch.id, sourceType: 'discovery' }
    })

    return NextResponse.json({
      success: true,
      counts: {
        queued,
        processing,
        done,
        failed,
        total: queued + processing + done + failed
      },
      lagSeconds: Math.round(p95Lag),
      lastItemTime: lastDone?.enqueuedAt.toISOString() || null,
      lastError: lastFailed?.lastError || null,
      lastErrorTime: lastFailed?.enqueuedAt.toISOString() || null,
      memoryCount
    })
  } catch (error) {
    console.error('[AgentHealth] Error:', error)
    return NextResponse.json(
      { error: 'Failed to get health status' },
      { status: 500 }
    )
  }
}

