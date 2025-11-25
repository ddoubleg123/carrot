import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/patches/[handle]/debug-heroes
 * Returns last 250 heroes for debugging
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  try {
    const { handle } = await params
    
    const patch = await prisma.patch.findUnique({
      where: { handle },
      select: { id: true }
    })
    
    if (!patch) {
      return NextResponse.json({ error: 'Patch not found' }, { status: 404 })
    }
    
    // Get heroes with their source content
    const heroes = await prisma.hero.findMany({
      where: {
        content: {
          patchId: patch.id
        }
      },
      include: {
        content: {
          select: {
            id: true,
            title: true,
            sourceUrl: true,
            textContent: true,
            metadata: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 250
    })
    
    // Transform to response format
    const heroesData = heroes.map(hero => {
      const metadata = hero.content.metadata as any || {}
      const textLength = hero.content.textContent?.length || 0
      const renderUsed = metadata.renderUsed === true || metadata.fetch_metadata?.render_used === true
      
      return {
        id: hero.id,
        contentId: hero.contentId,
        sourceUrl: hero.content.sourceUrl,
        title: hero.content.title,
        textLength,
        renderUsed,
        status: hero.status,
        imageUrl: hero.imageUrl,
        createdAt: hero.createdAt.toISOString(),
        updatedAt: hero.updatedAt.toISOString(),
        sourceTitle: hero.content.title
      }
    })
    
    return NextResponse.json({
      success: true,
      heroes: heroesData,
      count: heroesData.length
    })
  } catch (error) {
    console.error('[Debug Heroes API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

