/**
 * API endpoint to clean up stuck discovery runs
 * Can be called manually or via cron job
 */

import { NextResponse } from 'next/server'
import { cleanupStuckRuns } from '@/lib/discovery/runHealthMonitor'

export async function POST() {
  try {
    const result = await cleanupStuckRuns()
    
    return NextResponse.json({
      success: true,
      ...result
    })
  } catch (error) {
    console.error('[Cleanup Stuck Runs] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const { findStuckRuns } = await import('@/lib/discovery/runHealthMonitor')
    const stuckRuns = await findStuckRuns()
    
    return NextResponse.json({
      success: true,
      stuckRuns: stuckRuns.map(run => ({
        runId: run.runId,
        patchId: run.patchId,
        ageHours: run.ageHours,
        inactiveHours: run.inactiveHours,
        lastAuditAt: run.lastAuditAt?.toISOString() || null,
        redisState: run.redisState
      }))
    })
  } catch (error) {
    console.error('[Get Stuck Runs] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

