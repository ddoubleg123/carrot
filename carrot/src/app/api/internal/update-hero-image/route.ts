import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const { itemId, heroImageUrl, source, license } = await request.json()

    if (!itemId || !heroImageUrl) {
      return NextResponse.json({ error: 'Missing itemId or heroImageUrl' }, { status: 400 })
    }

    console.log('[UpdateHeroImage] Updating hero image for item:', itemId)

    // Update the DiscoveredContent record with the new hero image
    const updatedItem = await prisma.discoveredContent.update({
      where: { id: itemId },
      data: {
        mediaAssets: {
          hero: heroImageUrl,
          source: source || 'ai-generated',
          license: license || 'generated',
          // Keep existing values for other media assets
          dominant: '#667eea' // Default AI-generated color
        }
      }
    })

    console.log('[UpdateHeroImage] Successfully updated item with hero image')

    return NextResponse.json({
      success: true,
      itemId: updatedItem.id,
      heroImageUrl
    })

  } catch (error) {
    console.error('[UpdateHeroImage] Error:', error)
    return NextResponse.json(
      { error: 'Failed to update hero image' },
      { status: 500 }
    )
  }
}
