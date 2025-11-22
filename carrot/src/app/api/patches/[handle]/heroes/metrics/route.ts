import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/patches/[handle]/heroes/metrics
 * Returns hero metrics for the patch
 */
export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  try {
    const { handle } = await params

    // Find patch
    const patch = await prisma.patch.findUnique({
      where: { handle },
      select: { id: true }
    })

    if (!patch) {
      return NextResponse.json({ error: 'Patch not found' }, { status: 404 })
    }

    // Get counts
    const [totalHeroes, readyHeroes, errorHeroes, draftHeroes, totalContent] = await Promise.all([
      prisma.hero.count({
        where: { content: { patchId: patch.id } }
      }),
      prisma.hero.count({
        where: { content: { patchId: patch.id }, status: 'READY' }
      }),
      prisma.hero.count({
        where: { content: { patchId: patch.id }, status: 'ERROR' }
      }),
      prisma.hero.count({
        where: { content: { patchId: patch.id }, status: 'DRAFT' }
      }),
      prisma.discoveredContent.count({
        where: { patchId: patch.id }
      })
    ])

    return NextResponse.json({
      totalHeroes,
      readyHeroes,
      errorHeroes,
      draftHeroes,
      totalContent,
      heroesWithoutContent: totalContent - totalHeroes,
      successRate: totalHeroes > 0 ? (readyHeroes / totalHeroes) * 100 : 0
    })

  } catch (error) {
    console.error('[Heroes Metrics] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

