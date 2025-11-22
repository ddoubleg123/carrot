import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Health endpoint for enrichment observability
 * GET /api/internal/health/enrichment
 * Returns last 50 events and summary counters
 */
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    // Get summary counts
    const [totalHeroes, readyHeroes, errorHeroes, draftHeroes] = await Promise.all([
      prisma.hero.count(),
      prisma.hero.count({ where: { status: 'READY' } }),
      prisma.hero.count({ where: { status: 'ERROR' } }),
      prisma.hero.count({ where: { status: 'DRAFT' } })
    ])

    // Get recent heroes with traceIds for event reconstruction
    const recentHeroes = await prisma.hero.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        contentId: true,
        status: true,
        errorCode: true,
        traceId: true,
        createdAt: true,
        updatedAt: true
      }
    })

    // Count by error code
    const errorCodeCounts = await prisma.hero.groupBy({
      by: ['errorCode'],
      where: { status: 'ERROR' },
      _count: { errorCode: true }
    })

    return NextResponse.json({
      summary: {
        totalHeroes,
        readyHeroes,
        errorHeroes,
        draftHeroes,
        successRate: totalHeroes > 0 ? (readyHeroes / totalHeroes) * 100 : 0
      },
      errorBreakdown: errorCodeCounts.map(e => ({
        errorCode: e.errorCode || 'UNKNOWN',
        count: e._count.errorCode
      })),
      recentEvents: recentHeroes.map(h => ({
        heroId: h.id,
        contentId: h.contentId,
        status: h.status,
        errorCode: h.errorCode,
        traceId: h.traceId,
        createdAt: h.createdAt,
        updatedAt: h.updatedAt
      }))
    })

  } catch (error) {
    console.error('[Health Enrichment] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

