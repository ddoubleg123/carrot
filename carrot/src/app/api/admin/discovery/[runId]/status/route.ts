/**
 * GET /api/admin/discovery/:runId/status
 * Returns discovery run status with counts and recent events
 */

import { NextRequest, NextResponse } from 'next/server'
import { getEventsForRun, getEventCounts } from '@/lib/discovery/eventRing'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params

    const events = getEventsForRun(runId)
    const counts = events.reduce((acc: Record<string, number>, e: any) => {
      const k = `${e.step || 'unknown'}:${e.result || 'n/a'}`
      acc[k] = (acc[k] || 0) + 1
      return acc
    }, {})

    return NextResponse.json({
      runId,
      counts,
      last10: events.slice(-10),
      totalEvents: events.length,
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message,
      },
      { status: 500 }
    )
  }
}

