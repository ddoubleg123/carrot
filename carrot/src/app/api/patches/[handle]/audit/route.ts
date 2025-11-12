import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import prisma from '@/lib/prisma'
import {
  getAuditEvents,
  getRunState,
  getRunMetricsSnapshot,
  getZeroSaveDiagnostics,
  getPaywallBranches
} from '@/lib/redis/discovery'
import {
  buildAnalytics,
  buildWhyRejected,
  buildRobotsDecisions,
  computeSeedsVsQueries,
  buildTopCandidates
} from '@/lib/discovery/auditAnalytics'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, context: any) {
  try {
    const searchParams = new URL(request.url).searchParams
    const rawParams = context?.params
    const handle = typeof rawParams?.handle === 'string'
      ? rawParams.handle
      : Array.isArray(rawParams?.handle)
        ? rawParams.handle[0]
        : null

    if (!handle) {
      return NextResponse.json({ error: 'Missing patch handle' }, { status: 400 })
    }

    const patch = await prisma.patch.findUnique({
      where: { handle },
      select: {
        id: true,
        title: true,
        guide: true
      }
    })
    if (!patch) {
      return NextResponse.json({ error: 'Patch not found' }, { status: 404 })
    }

    const offset = parseInt(searchParams.get('cursor') ?? '0', 10)
    const limit = parseInt(searchParams.get('limit') ?? '100', 10)

    let items: any[] = []
    let nextOffset = offset
    let hasMore = false

    try {
      const redisResult = await getAuditEvents(patch.id, { offset, limit })
      items = redisResult.items
      nextOffset = redisResult.nextOffset
      hasMore = redisResult.hasMore
    } catch (redisError) {
      console.error('[Audit API] Redis audit fetch failed, falling back to database', redisError)
    }

    if (items.length === 0 && offset === 0) {
      const fallback = await prisma.discoveryAudit.findMany({
        where: { patchId: patch.id },
        orderBy: { ts: 'desc' },
        take: limit
      })

      return NextResponse.json({
        items: fallback,
        cursor: fallback.length,
        hasMore: fallback.length === limit,
        aggregate: {
          accepted: fallback.filter((audit) => audit.step === 'save' && audit.status === 'ok').length,
          denied: fallback.filter((audit) => audit.step === 'save' && audit.status !== 'ok').length,
          skipped: fallback.filter((audit) => audit.step.startsWith('skipped')).length,
          telemetry: null
        },
        plan: patch.guide ?? null,
        planHash: patch.guide ? createHash('sha1').update(JSON.stringify(patch.guide)).digest('hex') : null,
        run: null,
        runState: await getRunState(patch.id)
      })
    }

    const latestRun = await (prisma as any).discoveryRun.findFirst({
      where: { patchId: patch.id },
      orderBy: { startedAt: 'desc' }
    })

    const runState = await getRunState(patch.id)
    const runSnapshot = latestRun?.id ? await getRunMetricsSnapshot(latestRun.id).catch(() => null) : null
    const zeroSaveDiagnostics = await getZeroSaveDiagnostics(patch.id).catch(() => null)
    const paywallBranches = await getPaywallBranches(patch.id, 20).catch(() => [])
    const whyRejected = buildWhyRejected(items)
    const robotsDecisions = buildRobotsDecisions(items)
    const seedsVsQueries = computeSeedsVsQueries(items)
    const topCandidates = buildTopCandidates(items)
    const analytics = buildAnalytics(items, runSnapshot, {
      paywallBranches,
      zeroSaveDiagnostics,
      seedsVsQueries,
      whyRejected,
      robotsDecisions,
      topCandidates
    })

    return NextResponse.json({
      items,
      cursor: nextOffset,
      hasMore,
      aggregate: {
        accepted: items.filter((item) => item.step === 'save' && item.status === 'ok').length,
        denied: items.filter((item) => item.step === 'save' && item.status !== 'ok').length,
        skipped: items.filter((item) => item.step.startsWith('skipped')).length,
        telemetry: latestRun?.metrics?.telemetry ?? runSnapshot?.metrics?.telemetry ?? null
      },
      plan: patch.guide ?? null,
      planHash: patch.guide ? createHash('sha1').update(JSON.stringify(patch.guide)).digest('hex') : null,
      run: latestRun ?? null,
      runState,
      analytics
    })
  } catch (error) {
    console.error('[Audit API] Failed to fetch audit events', error)
    return NextResponse.json({ error: 'Failed to fetch audit events' }, { status: 500 })
  }
}
