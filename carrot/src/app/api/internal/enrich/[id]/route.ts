import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { resolveHero } from '@/lib/media/resolveHero'

/**
 * Internal API to enrich discovered content with hero images
 * POST /api/internal/enrich/[id]
 * Body: { sourceUrl?, assetUrl?, type }
 * Auth: X-Internal-Token header must match INTERNAL_ENRICH_TOKEN env var
 */
export const runtime = 'nodejs' // avoid Edge if using Node libs

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Auth check
    const token = request.headers.get('x-internal-token')
    const expectedToken = process.env.INTERNAL_ENRICH_TOKEN
    
    if (!expectedToken) {
      console.warn('[Enrich API] INTERNAL_ENRICH_TOKEN not configured')
      return NextResponse.json({ error: 'Service not configured' }, { status: 503 })
    }
    
    if (!token || token !== expectedToken) {
      console.warn('[Enrich API] Unauthorized request', { 
        hasToken: !!token,
        tokenLength: token?.length 
      })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({} as any))
    const { sourceUrl, assetUrl, type } = body

    console.log('[Enrich API] Processing content:', { id, type, sourceUrl: sourceUrl?.substring(0, 50) })

    // Get the content item
    const content = await prisma.discoveredContent.findUnique({
      where: { id },
      select: {
        id: true,
        category: true,
        sourceUrl: true,
        summary: true,
        hero: true
      }
    })

    if (!content) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 })
    }

    // Skip if already enriched
    const existingHero = content.hero as any
    if (existingHero?.url && existingHero?.source) {
      console.log('[Enrich API] Content already enriched:', id)
      return NextResponse.json({ 
        success: true, 
        message: 'Already enriched',
        hero: existingHero 
      })
    }

    try {
      // Resolve hero image using 4-tier pipeline
      const heroResult = await resolveHero({
        url: sourceUrl || content.sourceUrl || undefined,
        type: (type || content.category || 'article') as any,
        assetUrl,
        title: content.summary ? content.summary.slice(0, 80) : undefined,
        summary: content.summary || undefined
      })

      const heroPayload: Prisma.JsonObject = {
        url: heroResult.hero,
        source: heroResult.source,
        license: heroResult.license,
        blurDataURL: heroResult.blurDataURL,
        dominantColor: heroResult.dominant,
        enrichedAt: new Date().toISOString(),
        origin: 'internal-enrich'
      }

      await prisma.discoveredContent.update({
        where: { id },
        data: { 
          hero: heroPayload
        }
      })

      console.log('[Enrich API] Successfully enriched content:', id, 'source:', heroResult.source)

      // Return 202 to indicate async processing
      return NextResponse.json({
        ok: true,
        success: true,
        message: 'Content enriched successfully',
        hero: heroPayload,
        queued: true,
        id
      }, { status: 202 })

    } catch (error) {
      console.error('[Enrich API] Hero resolution failed:', error)
      
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
        hero: true
      }
    })

    if (!content) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 })
    }

    return NextResponse.json({
      id: content.id,
      hero: content.hero
    })

  } catch (error) {
    console.error('[Enrich API] GET Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
