import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const { itemId, heroImageUrl, source, license } = await request.json()

    if (!itemId || !heroImageUrl) {
      return NextResponse.json({ error: 'Missing itemId or heroImageUrl' }, { status: 400 })
    }

    console.log('[UpdateHeroImage] Updating hero image for item:', itemId)

    // First, get the existing mediaAssets to preserve other fields
    const existingItem = await prisma.discoveredContent.findUnique({
      where: { id: itemId },
      select: { mediaAssets: true }
    })

    // Merge with existing mediaAssets
    const existingMediaAssets = existingItem?.mediaAssets as any || {}
    const updatedMediaAssets = {
      ...existingMediaAssets,
      hero: heroImageUrl,
      source: source || 'ai-generated',
      license: license || 'generated',
      dominant: '#667eea' // Default AI-generated color
    }

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
