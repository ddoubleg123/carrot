import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { enrichContentId } from '@/lib/enrichment/worker'

/**
 * Internal API to enrich discovered content with hero images
 * POST /api/internal/enrich/[id]
 * Body: (optional, not used - contentId from URL)
 * Auth: X-Internal-Token header must match INTERNAL_ENRICH_TOKEN env var
 */
export const runtime = 'nodejs' // avoid Edge if using Node libs

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now()
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
        tokenLength: token?.length,
        path: request.nextUrl.pathname
      })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    if (!id) {
      console.warn('[Enrich API] Missing id parameter', { path: request.nextUrl.pathname })
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    console.log('[Enrich API] Processing content:', { 
      id, 
      path: request.nextUrl.pathname,
      method: request.method,
      timestamp: new Date().toISOString()
    })

    // Check if hero already exists and is READY
    const existingHero = await prisma.hero.findUnique({
      where: { contentId: id },
      select: { id: true, status: true }
    })

    if (existingHero && existingHero.status === 'READY') {
      console.log('[Enrich API] Content already enriched:', id)
      return NextResponse.json({ 
        success: true, 
        message: 'Already enriched',
        heroId: existingHero.id
      })
    }

    // Run enrichment
    const result = await enrichContentId(id)

    if (result.ok) {
      return NextResponse.json({
        ok: true,
        success: true,
        message: 'Content enriched successfully',
        heroId: result.heroId,
        traceId: result.traceId
      }, { status: 200 })
    } else {
      // Still return 200 but indicate error status
      return NextResponse.json({
        ok: false,
        success: false,
        error: result.errorMessage,
        errorCode: result.errorCode,
        traceId: result.traceId,
        note: 'Hero record created with ERROR status for retry'
      }, { status: 200 })
    }

  } catch (error) {
    console.error('[Enrich API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
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
