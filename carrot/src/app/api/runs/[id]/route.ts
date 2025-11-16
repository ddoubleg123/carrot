/**
 * GET /api/runs/:id
 * Returns the final run summary for a crawler run
 */

import { NextRequest, NextResponse } from 'next/server'

// In-memory store for run summaries (in production, use Redis or DB)
const runSummaries = new Map<string, any>()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // Try to get from in-memory store
    const summary = runSummaries.get(id)
    
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

// Export function to store run summaries (called by crawler)
// This is a separate export to avoid Next.js route handler issues
export const storeRunSummary = (runId: string, summary: any): void => {
  runSummaries.set(runId, summary)
  // Keep only last 100 runs in memory
  if (runSummaries.size > 100) {
    const firstKey = runSummaries.keys().next().value
    if (firstKey) {
      runSummaries.delete(firstKey)
    }
  }
}

