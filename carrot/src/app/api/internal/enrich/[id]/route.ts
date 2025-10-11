import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveHero } from '@/lib/media/resolveHero'
import { MediaAssets } from '@/lib/media/hero-types'

/**
 * Internal API to enrich discovered content with hero images
 * POST /api/internal/enrich/[id]
 * Body: { sourceUrl?, assetUrl?, type }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { sourceUrl, assetUrl, type } = body

    console.log('[Enrich API] Processing content:', { id, type, sourceUrl: sourceUrl?.substring(0, 50) })

    // Get the content item
    const content = await prisma.discoveredContent.findUnique({
      where: { id },
      select: {
        id: true,
        type: true,
        sourceUrl: true,
        mediaAssets: true,
        status: true
      }
    })

    if (!content) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 })
    }

    // Skip if already enriched
    const existingMedia = content.mediaAssets as MediaAssets | null
    if (existingMedia?.hero && existingMedia.source) {
      console.log('[Enrich API] Content already enriched:', id)
      return NextResponse.json({ 
        success: true, 
        message: 'Already enriched',
        mediaAssets: existingMedia 
      })
    }

    // Update status to enriching
    await prisma.discoveredContent.update({
      where: { id },
      data: { status: 'enriching' }
    })

    try {
      // Resolve hero image using 4-tier pipeline
      const heroResult = await resolveHero({
        url: sourceUrl || content.sourceUrl || undefined,
        type: (type || content.type) as any,
        assetUrl
      })

      // Update mediaAssets with hero data
      const updatedMediaAssets: MediaAssets = {
        ...existingMedia,
        hero: heroResult.hero,
        blurDataURL: heroResult.blurDataURL,
        dominant: heroResult.dominant,
        source: heroResult.source,
        license: heroResult.license
      }

      // Update content in database
      await prisma.discoveredContent.update({
        where: { id },
        data: { 
          mediaAssets: updatedMediaAssets as any, // Cast to satisfy Prisma JSON type
          status: 'ready'
        }
      })

      console.log('[Enrich API] Successfully enriched content:', id, 'source:', heroResult.source)

      return NextResponse.json({
        success: true,
        message: 'Content enriched successfully',
        mediaAssets: updatedMediaAssets
      })

    } catch (error) {
      console.error('[Enrich API] Hero resolution failed:', error)
      
      // Update status to failed
      await prisma.discoveredContent.update({
        where: { id },
        data: { 
          status: 'failed'
        }
      })

      return NextResponse.json({
        success: false,
        error: 'Hero resolution failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 })
    }

  } catch (error) {
    console.error('[Enrich API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET endpoint to check enrichment status
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const content = await prisma.discoveredContent.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        mediaAssets: true
      }
    })

    if (!content) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 })
    }

    return NextResponse.json({
      id: content.id,
      status: content.status,
      mediaAssets: content.mediaAssets
    })

  } catch (error) {
    console.error('[Enrich API] GET Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
