import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/system/health-check
 * Comprehensive health check for the discovery and agent learning system
 */
export async function GET() {
  try {
    const health = {
      timestamp: new Date().toISOString(),
      status: 'healthy' as 'healthy' | 'degraded' | 'unhealthy',
      checks: {
        database: { status: 'unknown' as string, message: '' },
        untitledItems: { count: 0, status: 'unknown' as string },
        agentMemory: { missingFields: 0, status: 'unknown' as string },
        feedQueue: { pending: 0, processing: 0, stuck: 0, status: 'unknown' as string }
      },
      issues: [] as string[]
    }

    // Check database
    try {
      await prisma.$queryRaw`SELECT 1`
      health.checks.database.status = 'healthy'
    } catch (error) {
      health.checks.database.status = 'unhealthy'
      health.checks.database.message = error instanceof Error ? error.message : 'Database connection failed'
      health.status = 'unhealthy'
      health.issues.push('Database connection failed')
    }

    // Check for untitled items
    try {
      const untitledCount = await prisma.discoveredContent.count({
        where: {
          OR: [
            { title: 'Untitled' },
            { title: 'Untitled Content' }
          ]
        }
      })
      health.checks.untitledItems.count = untitledCount
      health.checks.untitledItems.status = untitledCount > 10 ? 'degraded' : 'healthy'
      if (untitledCount > 10) {
        health.issues.push(`${untitledCount} items with "Untitled" titles`)
        if (health.status === 'healthy') health.status = 'degraded'
      }
    } catch (error) {
      health.checks.untitledItems.status = 'unknown'
    }

    // Check AgentMemory entries missing fields
    try {
      const missingFieldsCount = await prisma.agentMemory.count({
        where: {
          sourceType: 'discovery',
          OR: [
            { patchId: null },
            { discoveredContentId: null }
          ]
        }
      })
      health.checks.agentMemory.missingFields = missingFieldsCount
      health.checks.agentMemory.status = missingFieldsCount > 20 ? 'degraded' : 'healthy'
      if (missingFieldsCount > 20) {
        health.issues.push(`${missingFieldsCount} AgentMemory entries missing discovery fields`)
        if (health.status === 'healthy') health.status = 'degraded'
      }
    } catch (error) {
      health.checks.agentMemory.status = 'unknown'
    }

    // Check feed queue
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
      const [pending, processing, stuck] = await Promise.all([
        (prisma as any).agentMemoryFeedQueue.count({ where: { status: 'PENDING' } }),
        (prisma as any).agentMemoryFeedQueue.count({ where: { status: 'PROCESSING' } }),
        (prisma as any).agentMemoryFeedQueue.count({
          where: {
            status: 'PROCESSING',
            pickedAt: { lt: oneHourAgo }
          }
        })
      ])

      health.checks.feedQueue.pending = pending
      health.checks.feedQueue.processing = processing
      health.checks.feedQueue.stuck = stuck

      if (stuck > 5) {
        health.checks.feedQueue.status = 'degraded'
        health.issues.push(`${stuck} stuck queue items`)
        if (health.status === 'healthy') health.status = 'degraded'
      } else if (pending > 100) {
        health.checks.feedQueue.status = 'degraded'
        health.issues.push(`${pending} pending queue items`)
        if (health.status === 'healthy') health.status = 'degraded'
      } else {
        health.checks.feedQueue.status = 'healthy'
      }
    } catch (error) {
      health.checks.feedQueue.status = 'unknown'
    }

    const statusCode = health.status === 'unhealthy' ? 503 : health.status === 'degraded' ? 200 : 200

    return NextResponse.json(health, { status: statusCode })
  } catch (error) {
    return NextResponse.json(
      {
        timestamp: new Date().toISOString(),
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

