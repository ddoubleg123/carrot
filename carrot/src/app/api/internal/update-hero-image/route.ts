import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { MediaAssets, HeroSource, HeroLicense } from '@/lib/media/hero-types'

export async function POST(request: NextRequest) {
  let itemId: string | undefined
  let heroImageUrl: string | undefined
  
  try {
    const requestData = await request.json()
    itemId = requestData.itemId
    heroImageUrl = requestData.heroImageUrl
    const { source, license } = requestData

    if (!itemId || !heroImageUrl) {
      return NextResponse.json({ error: 'Missing itemId or heroImageUrl' }, { status: 400 })
    }

    console.log('[UpdateHeroImage] Updating hero image for item:', itemId)

    // First, check if the item exists
    const existingItem = await prisma.discoveredContent.findUnique({
      where: { id: itemId },
      select: { id: true, mediaAssets: true, title: true }
    })

    if (!existingItem) {
      console.error('[UpdateHeroImage] Item not found:', itemId)
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    console.log('[UpdateHeroImage] Found item:', { id: existingItem.id, title: existingItem.title })

    // Merge with existing mediaAssets
    const existingMediaAssets = existingItem.mediaAssets as MediaAssets || {}
    const updatedMediaAssets: MediaAssets = {
      ...existingMediaAssets,
      hero: heroImageUrl,
      source: (source as HeroSource) || 'ai-generated',
      license: (license as HeroLicense) || 'generated',
      dominant: '#667eea' // Default AI-generated color
    }

    console.log('[UpdateHeroImage] Updating mediaAssets:', { 
      existing: Object.keys(existingMediaAssets), 
      updated: Object.keys(updatedMediaAssets) 
    })

    // Update the DiscoveredContent record with the new hero image
    const updatedItem = await prisma.discoveredContent.update({
      where: { id: itemId },
      data: {
        mediaAssets: updatedMediaAssets
      }
    })

    console.log('[UpdateHeroImage] Successfully updated item with hero image')

    return NextResponse.json({
      success: true,
      itemId: updatedItem.id,
      heroImageUrl
    })

  } catch (error) {
    console.error('[UpdateHeroImage] Error details:', {
      error: error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      itemId,
      heroImageUrl: heroImageUrl?.substring(0, 50)
    })
    return NextResponse.json(
      { 
        error: 'Failed to update hero image',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
