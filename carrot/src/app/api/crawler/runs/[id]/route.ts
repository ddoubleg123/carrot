/**
 * Get run summary
 * GET /api/crawler/runs/:id
 */

import { NextResponse } from 'next/server'
import { getRunSummary } from '@/lib/discovery/crawlerStore'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  
  const summary = getRunSummary(id)
  
  if (!summary) {
    return NextResponse.json(
      { error: 'Run not found' },
      { status: 404 }
    )
  }

  return NextResponse.json(summary)
}

