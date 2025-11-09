import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  try {
    const { handle } = await params
    const { searchParams } = new URL(request.url)
    const runId = searchParams.get('runId')
    const limit = parseInt(searchParams.get('limit') || '200')
    const step = searchParams.get('step')
    const status = searchParams.get('status')
    const provider = searchParams.get('provider')
    const decision = searchParams.get('decision')
    const allPatches = searchParams.get('allPatches') === 'true'

    // Get patch (optional if allPatches is true)
    let patch = null
    if (!allPatches) {
      patch = await prisma.patch.findUnique({
        where: { handle }
      })
      if (!patch) {
        return NextResponse.json({ error: 'Patch not found' }, { status: 404 })
      }
    }

    // Build where clause - if allPatches, don't filter by patchId
    const where: any = {}
    if (!allPatches && patch) {
      where.patchId = patch.id
    }
    if (runId) where.runId = runId
    if (step) where.step = step
    if (status) where.status = status
    if (provider) where.provider = provider

    // Get runs - show all if allPatches, otherwise just for this patch
    const runsWhere: any = {}
    if (!allPatches && patch) {
      runsWhere.patchId = patch.id
    }
    
    const runs = await (prisma as any).discoveryRun.findMany({
      where: runsWhere,
      orderBy: { startedAt: 'desc' },
      take: 50, // Show more runs
      include: {
        patch: {
          select: {
            handle: true,
            title: true
          }
        }
      }
    })

    // Get audits with patch info
    const audits = await prisma.discoveryAudit.findMany({
      where,
      orderBy: { ts: 'desc' }, // Most recent first
      take: limit,
      include: {
        patch: {
          select: {
            handle: true,
            title: true
          }
        }
      }
    })

    // Filter by decision if provided (since it's in JSON)
    let filteredAudits = audits
    if (decision) {
      filteredAudits = audits.filter(audit => {
        const decisions = audit.decisions as any
        return decisions?.action === decision
      })
    }

    // Get selected run metrics
    const selectedRun = runId 
      ? await (prisma as any).discoveryRun.findUnique({ 
          where: { id: runId },
          include: {
            patch: {
              select: {
                handle: true,
                title: true
              }
            }
          }
        })
      : runs[0]

    return NextResponse.json({
      runs,
      audits: filteredAudits,
      run: selectedRun ? {
        ...selectedRun,
        metrics: selectedRun.metrics || {}
      } : null
    })
  } catch (error: any) {
    console.error('[Audit List] Error:', error)
    console.error('[Audit List] Stack:', error.stack)
    return NextResponse.json(
      { error: error.message || 'Internal server error', stack: process.env.NODE_ENV === 'development' ? error.stack : undefined },
      { status: 500 }
    )
  }
}
