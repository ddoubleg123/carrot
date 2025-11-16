/**
 * GET /api/runs/:id
 * Returns the final run summary for a crawler run
 */

import { NextRequest, NextResponse } from 'next/server'
import { getRunSummary } from '@/lib/discovery/crawlerStore'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const summary = getRunSummary(id)
    
    if (!summary) {
      return NextResponse.json(
        {
          error: 'Run not found',
          runId: id
        },
        { status: 404 }
      )
    }

    return NextResponse.json(summary, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message
      },
      { status: 500 }
    )
  }
}

