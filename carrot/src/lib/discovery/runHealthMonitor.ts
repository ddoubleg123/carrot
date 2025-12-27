/**
 * Run Health Monitor
 * Detects and cleans up stuck discovery runs
 */

import { prisma } from '@/lib/prisma'
import { setRunState, getRunState } from '@/lib/redis/discovery'

const STUCK_RUN_THRESHOLD_MS = 2 * 60 * 60 * 1000 // 2 hours
const INACTIVE_RUN_THRESHOLD_MS = 6 * 60 * 60 * 1000 // 6 hours

interface StuckRunInfo {
  runId: string
  patchId: string
  startedAt: Date
  ageHours: number
  lastAuditAt: Date | null
  inactiveHours: number | null
  redisState: 'live' | 'suspended' | 'paused' | null
}

/**
 * Find all stuck discovery runs
 */
export async function findStuckRuns(): Promise<StuckRunInfo[]> {
  const now = new Date()
  const stuckThreshold = new Date(now.getTime() - STUCK_RUN_THRESHOLD_MS)
  
  // Find runs that are marked as 'live' in the database
  const liveRuns = await prisma.discoveryRun.findMany({
    where: {
      status: 'live',
      startedAt: {
        lt: stuckThreshold // Older than threshold
      }
    },
    select: {
      id: true,
      patchId: true,
      startedAt: true,
      metrics: true
    },
    orderBy: {
      startedAt: 'asc'
    }
  })

  const stuckRuns: StuckRunInfo[] = []

  for (const run of liveRuns) {
    // Check for recent audit activity
    const lastAudit = await prisma.discoveryAudit.findFirst({
      where: {
        runId: run.id
      },
      orderBy: {
        ts: 'desc'
      },
      select: {
        ts: true
      }
    })

    const ageMs = now.getTime() - run.startedAt.getTime()
    const ageHours = ageMs / (60 * 60 * 1000)
    
    const lastAuditAt = lastAudit?.ts || null
    const inactiveMs = lastAuditAt ? now.getTime() - lastAuditAt.getTime() : null
    const inactiveHours = inactiveMs ? inactiveMs / (60 * 60 * 1000) : null

    // Check Redis state
    const redisState = await getRunState(run.patchId).catch(() => null)

    // Consider a run stuck if:
    // 1. It's older than threshold AND
    // 2. (No recent audit activity OR inactive for more than threshold)
    const isStuck = ageMs > STUCK_RUN_THRESHOLD_MS && (
      !lastAuditAt || 
      (inactiveMs !== null && inactiveMs > INACTIVE_RUN_THRESHOLD_MS)
    )

    if (isStuck) {
      stuckRuns.push({
        runId: run.id,
        patchId: run.patchId,
        startedAt: run.startedAt,
        ageHours: Math.round(ageHours * 10) / 10,
        lastAuditAt,
        inactiveHours: inactiveHours ? Math.round(inactiveHours * 10) / 10 : null,
        redisState
      })
    }
  }

  return stuckRuns
}

/**
 * Clean up stuck runs by marking them as suspended
 */
export async function cleanupStuckRuns(): Promise<{
  found: number
  cleaned: number
  errors: number
}> {
  const stuckRuns = await findStuckRuns()
  
  console.log(`[RunHealthMonitor] Found ${stuckRuns.length} stuck runs`)

  let cleaned = 0
  let errors = 0

  for (const run of stuckRuns) {
    try {
      // Mark run as suspended in database
      await prisma.discoveryRun.update({
        where: { id: run.runId },
        data: {
          status: 'suspended',
          endedAt: new Date(),
          metrics: {
            ...(run.lastAuditAt ? { lastActivity: run.lastAuditAt.toISOString() } : {}),
            cleanupReason: 'stuck_run_cleanup',
            ageHours: run.ageHours,
            inactiveHours: run.inactiveHours
          }
        }
      })

      // Also update Redis state if it's still 'live'
      if (run.redisState === 'live') {
        await setRunState(run.patchId, 'suspended').catch(() => {
          // Non-fatal if Redis update fails
        })
      }

      console.log(`[RunHealthMonitor] ✅ Cleaned up stuck run: ${run.runId} (age: ${run.ageHours}h, inactive: ${run.inactiveHours || 'N/A'}h)`)
      cleaned++
    } catch (error) {
      console.error(`[RunHealthMonitor] ❌ Failed to clean up run ${run.runId}:`, error)
      errors++
    }
  }

  return {
    found: stuckRuns.length,
    cleaned,
    errors
  }
}

/**
 * Get health status for a specific patch
 */
export async function getPatchRunHealth(patchId: string): Promise<{
  activeRuns: number
  stuckRuns: number
  lastActivity: Date | null
}> {
  const now = new Date()
  const stuckThreshold = new Date(now.getTime() - STUCK_RUN_THRESHOLD_MS)

  const activeRuns = await prisma.discoveryRun.count({
    where: {
      patchId,
      status: 'live'
    }
  })

  const stuckRuns = await prisma.discoveryRun.count({
    where: {
      patchId,
      status: 'live',
      startedAt: {
        lt: stuckThreshold
      }
    }
  })

  const lastAudit = await prisma.discoveryAudit.findFirst({
    where: {
      patchId
    },
    orderBy: {
      ts: 'desc'
    },
    select: {
      ts: true
    }
  })

  return {
    activeRuns,
    stuckRuns,
    lastActivity: lastAudit?.ts || null
  }
}

