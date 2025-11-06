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

    // Get patch
    const patch = await prisma.patch.findUnique({
      where: { handle }
    })

    if (!patch) {
      return NextResponse.json({ error: 'Patch not found' }, { status: 404 })
    }

    // Build where clause
    const where: any = { patchId: patch.id }
    if (runId) where.runId = runId
    if (step) where.step = step
    if (status) where.status = status
    if (provider) where.provider = provider
    if (decision) {
      // Decision is stored in decisions JSON, so we'll filter in memory or use a different approach
      // For now, skip decision filtering at DB level
    }

    // Get runs
    const runs = await prisma.discoveryRun.findMany({
      where: { patchId: patch.id },
      orderBy: { startedAt: 'desc' },
      take: 10
    })

    // Get audits - use 'ts' field instead of 'createdAt'
    const audits = await prisma.discoveryAudit.findMany({
      where,
      orderBy: { ts: 'asc' },
      take: limit
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
      ? await prisma.discoveryRun.findUnique({ where: { id: runId } })
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
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
