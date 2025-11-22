import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SaveHeroSchema = z.object({
  contentId: z.string(),
  heroUrl: z.string().url(),
  heroSource: z.enum(['ai', 'wikimedia', 'skeleton', 'openverse']),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  attribution: z.string().optional()
})

/**
 * Save/update hero image for discovered content
 * POST /api/patches/[handle]/save-hero
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ handle: string }> }
) {
  try {
    const { handle } = await params
    const body = await req.json()
    
    // Validate request
    const validation = SaveHeroSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        },
        { status: 400 }
      )
    }
    
    const { contentId, heroUrl, heroSource, width, height, attribution } = validation.data
    
    // Verify patch exists
    const patch = await prisma.patch.findUnique({
      where: { handle },
      select: { id: true }
    })
    
    if (!patch) {
      return NextResponse.json({ error: 'Patch not found' }, { status: 404 })
    }
    
    // Verify content belongs to this patch
    const content = await prisma.discoveredContent.findFirst({
      where: {
        id: contentId,
        patchId: patch.id
      },
      select: { id: true }
    })
    
    if (!content) {
      return NextResponse.json(
        { error: 'Content not found or does not belong to this patch' },
        { status: 404 }
      )
    }
    
    // Update hero image
    const updated = await prisma.discoveredContent.update({
      where: { id: contentId },
      data: {
        hero: {
          url: heroUrl,
          source: heroSource,
          width,
          height,
          attribution,
          updatedAt: new Date().toISOString()
        } as any
      },
      select: {
        id: true,
        title: true,
        hero: true
      }
    })
    
    console.log('[Save Hero] Updated hero for content:', {
      contentId,
      patchId: patch.id,
      handle,
      heroSource
    })
    
    return NextResponse.json({
      success: true,
      contentId: updated.id,
      title: updated.title,
      hero: updated.hero
    })
  } catch (error) {
    console.error('[Save Hero] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to save hero image',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

