import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveHero } from '@/lib/media/resolveHero'
import { MediaAssets } from '@/lib/media/hero-types'

/**
 * Batch enrichment API for backfilling existing content
 * POST /api/internal/enrich/batch
 * Body: { patchId?, limit?, status? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { patchId, limit = 10, status = 'ready' } = body

    console.log('[Batch Enrich] Starting batch enrichment:', { patchId, limit, status })

    // Find content items that need enrichment
    const whereClause = {
      ...(patchId && { patchId }),
      status,
      OR: [
        { mediaAssets: null },
        { mediaAssets: { path: ['hero'], equals: null } },
        { mediaAssets: { path: ['source'], equals: null } }
      ]
    }

    const contentItems = await prisma.discoveredContent.findMany({
      where: whereClause,
      select: {
        id: true,
        type: true,
        sourceUrl: true,
        mediaAssets: true,
        status: true
      },
      take: limit,
      orderBy: { createdAt: 'desc' }
    })

    console.log('[Batch Enrich] Found items to enrich:', contentItems.length)

    const results = []
    const errors = []

    for (const item of contentItems) {
      try {
        console.log('[Batch Enrich] Processing item:', item.id, 'type:', item.type)

        // Update status to enriching
        await prisma.discoveredContent.update({
          where: { id: item.id },
          data: { status: 'enriching' }
        })

        // Resolve hero image
        const heroResult = await resolveHero({
          url: item.sourceUrl || undefined,
          type: item.type as any
        })

        // Update mediaAssets
        const existingMedia = item.mediaAssets as MediaAssets | null
        const updatedMediaAssets: MediaAssets = {
          ...existingMedia,
          hero: heroResult.hero,
          blurDataURL: heroResult.blurDataURL,
          dominant: heroResult.dominant,
          source: heroResult.source,
          license: heroResult.license
        }

        // Update database
        await prisma.discoveredContent.update({
          where: { id: item.id },
          data: { 
            mediaAssets: updatedMediaAssets as any, // Cast to satisfy Prisma JSON type
            status: 'ready'
          }
        })

        results.push({
          id: item.id,
          type: item.type,
          source: heroResult.source,
          success: true
        })

        console.log('[Batch Enrich] Successfully enriched:', item.id, 'source:', heroResult.source)

      } catch (error) {
        console.error('[Batch Enrich] Failed to enrich item:', item.id, error)

        // Update status to failed
        await prisma.discoveredContent.update({
          where: { id: item.id },
          data: { status: 'failed' }
        })

        errors.push({
          id: item.id,
          type: item.type,
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

    // Get counts by status
    const [total, ready, enriching, failed, needsEnrichment] = await Promise.all([
      prisma.discoveredContent.count({ where: whereClause }),
      prisma.discoveredContent.count({ where: { ...whereClause, status: 'ready' } }),
      prisma.discoveredContent.count({ where: { ...whereClause, status: 'enriching' } }),
      prisma.discoveredContent.count({ where: { ...whereClause, status: 'failed' } }),
      prisma.discoveredContent.count({
        where: {
          ...whereClause,
          OR: [
            { mediaAssets: null },
            { mediaAssets: { path: ['hero'], equals: null } },
            { mediaAssets: { path: ['source'], equals: null } }
          ]
        }
      })
    ])

    return NextResponse.json({
      total,
      ready,
      enriching,
      failed,
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
