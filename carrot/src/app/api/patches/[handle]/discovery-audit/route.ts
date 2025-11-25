import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/patches/[handle]/discovery-audit
 * Returns discovery audit events for a patch/run
 * Query params: runId (optional), limit (default 100), cursor (optional)
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  try {
    const { handle } = await params
    const { searchParams } = new URL(request.url)
    const runId = searchParams.get('runId')
    const limit = parseInt(searchParams.get('limit') || '100', 10)
    const cursor = searchParams.get('cursor')
    
    const patch = await prisma.patch.findUnique({
      where: { handle },
      select: { id: true }
    })
    
    if (!patch) {
      return NextResponse.json({ error: 'Patch not found' }, { status: 404 })
    }
    
    // Build where clause
    const where: any = {
      patchId: patch.id
    }
    
    if (runId) {
      where.runId = runId
    }
    
    // Cursor-based pagination
    if (cursor) {
      const cursorDate = new Date(cursor)
      if (!isNaN(cursorDate.getTime())) {
        where.ts = { lt: cursorDate }
      }
    }
    
    // Get audit events
    const events = await prisma.discoveryAudit.findMany({
      where,
      orderBy: { ts: 'desc' },
      take: limit,
      select: {
        id: true,
        runId: true,
        patchId: true,
        step: true,
        status: true,
        ts: true,
        provider: true,
        query: true,
        candidateUrl: true,
        finalUrl: true,
        http: true,
        meta: true,
        rulesHit: true,
        scores: true,
        decisions: true,
        hashes: true,
        synthesis: true,
        hero: true,
        timings: true,
        error: true
      }
    })
    
    // Determine next cursor
    const lastEvent = events[events.length - 1]
    const nextCursor = lastEvent ? lastEvent.ts.toISOString() : null
    
    // Group events by phase for easier consumption
    const phases = ['seed', 'fetch', 'extract', 'save', 'hero', 'error'] as const
    const eventsByPhase = phases.reduce((acc, phase) => {
      acc[phase] = events.filter(e => 
        e.step.includes(phase) || 
        (phase === 'error' && e.status === 'fail')
      )
      return acc
    }, {} as Record<string, typeof events>)
    
    // Calculate counts per phase
    const phaseCounts = Object.fromEntries(
      phases.map(phase => [phase, eventsByPhase[phase].length])
    )
    
    return NextResponse.json({
      success: true,
      patchId: patch.id,
      patchHandle: handle,
      runId: runId || null,
      events,
      phaseCounts,
      eventsByPhase,
      pagination: {
        limit,
        count: events.length,
        nextCursor,
        hasMore: events.length === limit
      }
    })
  } catch (error) {
    console.error('[Discovery Audit API] Error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}

