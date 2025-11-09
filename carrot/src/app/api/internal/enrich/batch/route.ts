import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveHero } from '@/lib/media/resolveHero'
import { Prisma } from '@prisma/client'

/**
 * Batch enrichment API for backfilling existing content
 * POST /api/internal/enrich/batch
 * Body: { patchId?, limit?, status? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { patchId, limit = 10, status = 'missing' } = body

    console.log('[Batch Enrich] Starting batch enrichment:', { patchId, limit, status })

    const baseWhere: Record<string, unknown> = {
      ...(patchId && { patchId })
    }

    const heroMissingFilter = {
      OR: [
        { hero: { equals: Prisma.JsonNull } },
        { hero: { path: ['url'], equals: Prisma.JsonNull } }
      ]
    }

    const heroPresentFilter = {
      hero: { path: ['url'], not: Prisma.JsonNull }
    }

    const whereClause = status === 'hasHero'
      ? { ...baseWhere, ...heroPresentFilter }
      : status === 'all'
        ? baseWhere
        : { ...baseWhere, ...heroMissingFilter }

    const contentItems = await prisma.discoveredContent.findMany({
      where: whereClause,
      select: {
        id: true,
        category: true,
        sourceUrl: true,
        summary: true,
        hero: true
      },
      take: limit,
      orderBy: { createdAt: 'desc' }
    })

    console.log('[Batch Enrich] Found items to enrich:', contentItems.length)

    const results = []
    const errors = []

    for (const item of contentItems) {
      try {
        console.log('[Batch Enrich] Processing item:', item.id, 'category:', item.category)

        // Resolve hero image
        const heroResult = await resolveHero({
          url: item.sourceUrl || undefined,
          type: (item.category as any) || 'article',
          summary: item.summary || undefined
        })

        const heroPayload: Prisma.JsonObject = {
          url: heroResult.hero,
          source: heroResult.source,
          license: heroResult.license,
          blurDataURL: heroResult.blurDataURL,
          dominantColor: heroResult.dominant,
          enrichedAt: new Date().toISOString(),
          origin: 'batch-enrich'
        }

        await prisma.discoveredContent.update({
          where: { id: item.id },
          data: { 
            hero: heroPayload
          }
        })

        results.push({
          id: item.id,
          category: item.category,
          source: heroResult.source,
          success: true
        })

        console.log('[Batch Enrich] Successfully enriched:', item.id, 'source:', heroResult.source)

      } catch (error) {
        console.error('[Batch Enrich] Failed to enrich item:', item.id, error)

        errors.push({
          id: item.id,
          category: item.category,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${contentItems.length} items`,
      results,
      errors,
      summary: {
        total: contentItems.length,
        successful: results.length,
        failed: errors.length
      }
    })

  } catch (error) {
    console.error('[Batch Enrich] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET endpoint to check batch enrichment progress
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const patchId = searchParams.get('patchId')

    const whereClause = {
      ...(patchId && { patchId })
    }

    const heroMissingFilter = {
      OR: [
        { hero: { equals: Prisma.JsonNull } },
        { hero: { path: ['url'], equals: Prisma.JsonNull } }
      ]
    }

    const [total, needsEnrichment] = await Promise.all([
      prisma.discoveredContent.count({ where: whereClause }),
      prisma.discoveredContent.count({ where: { ...whereClause, ...heroMissingFilter } })
    ])

    return NextResponse.json({
      total,
      needsEnrichment,
      enriched: total - needsEnrichment
    })

  } catch (error) {
    console.error('[Batch Enrich] GET Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
