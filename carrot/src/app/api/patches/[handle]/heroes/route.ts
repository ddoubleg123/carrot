import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/patches/[handle]/heroes
 * Returns hero cards for the patch
 */
export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  try {
    const { handle } = await params
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const cursor = searchParams.get('cursor')

    // Find patch
    const patch = await prisma.patch.findUnique({
      where: { handle },
      select: { id: true }
    })

    if (!patch) {
      return NextResponse.json({ error: 'Patch not found' }, { status: 404 })
    }

    // Query heroes with their content
    const whereClause: any = {
      content: {
        patchId: patch.id
      },
      status: 'READY' // Only return ready heroes
    }

    if (cursor) {
      whereClause.id = { gt: cursor }
    }

    const [heroes, total] = await Promise.all([
      prisma.hero.findMany({
        where: whereClause,
        include: {
          content: {
            select: {
              id: true,
              title: true,
              canonicalUrl: true,
              sourceUrl: true,
              sourceDomain: true,
              domain: true,
              summary: true,
              relevanceScore: true,
              qualityScore: true,
              createdAt: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: cursor ? 0 : offset
      }),
      prisma.hero.count({
        where: whereClause
      })
    ])

    // Transform to hero card format
    const items = heroes.map(hero => ({
      id: hero.id,
      contentId: hero.contentId,
      title: hero.title,
      excerpt: hero.excerpt,
      quoteHtml: hero.quoteHtml,
      quoteCharCount: hero.quoteCharCount,
      imageUrl: hero.imageUrl,
      sourceUrl: hero.sourceUrl,
      createdAt: hero.createdAt,
      content: {
        id: hero.content.id,
        title: hero.content.title,
        url: hero.content.canonicalUrl || hero.content.sourceUrl,
        domain: hero.content.sourceDomain || hero.content.domain || 'unknown',
        summary: hero.content.summary,
        relevanceScore: hero.content.relevanceScore,
        qualityScore: hero.content.qualityScore,
        savedAt: hero.content.createdAt
      }
    }))

    // Get next cursor
    const nextCursor = heroes.length === limit && heroes.length > 0
      ? heroes[heroes.length - 1].id
      : null

    return NextResponse.json({
      items,
      total,
      nextCursor,
      hasMore: nextCursor !== null
    })

  } catch (error) {
    console.error('[Heroes API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

