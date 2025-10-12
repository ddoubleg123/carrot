import { DiscoveredItem } from '@/types/discovered-content'

/**
 * Generates AI hero image for a DiscoveredItem and updates it in the database
 */
async function generateAIHeroImage(item: DiscoveredItem): Promise<void> {
  try {
    console.log('[generateAIHeroImage] Starting AI generation for:', item.title.substring(0, 50))
    
    // Call the AI generation API
    const response = await fetch('/api/ai/generate-hero-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: item.title,
        summary: item.content.summary150,
        sourceDomain: item.meta?.sourceDomain,
        contentType: item.type,
        patchTheme: item.patchHandle // Use patch handle as theme context
      })
    })

    if (!response.ok) {
      throw new Error(`AI generation failed: ${response.status}`)
    }

    const result = await response.json()
    
    if (result.success && result.imageUrl) {
      console.log('[generateAIHeroImage] AI image generated, updating database')
      
      // Update the item in the database with the new hero image
      await updateItemWithHeroImage(item.id, result.imageUrl)
    }
  } catch (error) {
    console.error('[generateAIHeroImage] Error:', error)
  }
}

/**
 * Updates a DiscoveredItem with the new hero image
 */
async function updateItemWithHeroImage(itemId: string, heroImageUrl: string): Promise<void> {
  try {
    // Update the mediaAssets in the database
    const response = await fetch('/api/internal/update-hero-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        itemId,
        heroImageUrl,
        source: 'ai-generated',
        license: 'generated'
      })
    })

    if (!response.ok) {
      throw new Error(`Failed to update hero image: ${response.status}`)
    }

    console.log('[updateItemWithHeroImage] Successfully updated item with AI hero image')
  } catch (error) {
    console.error('[updateItemWithHeroImage] Error:', error)
  }
}

/**
 * Picks the best available hero image from a DiscoveredItem
 * Prioritizes real media over generated covers
 */
export function pickHero(item: DiscoveredItem): string | null {
  const media = item.media
  
  // Debug logging
  console.log('[pickHero] Checking media for item:', {
    id: item.id,
    title: item.title,
    media: media,
    hero: media?.hero,
    videoThumb: media?.videoThumb,
    pdfPreview: media?.pdfPreview,
    gallery: media?.gallery
  })
  
  // Priority order: hero → videoThumb → pdfPreview → gallery[0]
  if (media?.hero) {
    console.log('[pickHero] Using hero:', media.hero)
    return media.hero
  }
  
  if (media?.videoThumb) {
    console.log('[pickHero] Using videoThumb:', media.videoThumb)
    return media.videoThumb
  }
  
  if (media?.pdfPreview) {
    console.log('[pickHero] Using pdfPreview:', media.pdfPreview)
    return media.pdfPreview
  }
  
  if (media?.gallery && media.gallery.length > 0) {
    console.log('[pickHero] Using gallery[0]:', media.gallery[0])
    return media.gallery[0]
  }
  
  // No real media available - will fall back to GeneratedCover
  console.log('[pickHero] No real media found, triggering AI image generation')
  
  // Trigger AI image generation asynchronously (don't wait for it)
  if (item.title && item.content?.summary150) {
    generateAIHeroImage(item).catch(error => {
      console.warn('[pickHero] AI image generation failed:', error)
    })
  }
  
  return null // Still return null for now, AI generation will update the item later
}

/**
 * Gets the dominant color for background/placeholder
 */
export function getDominantColor(item: DiscoveredItem): string {
  return item.media?.dominant || '#F3F4F6'
}

/**
 * Gets the blur placeholder for smooth loading
 */
export function getBlurPlaceholder(item: DiscoveredItem): string | null {
  return item.media?.blurDataURL || null
}

/**
 * Gets the media source for debugging/attribution
 */
export function getMediaSource(item: DiscoveredItem): string {
  return item.media?.source || 'unknown'
}

/**
 * Checks if the hero is generated (fallback) vs real media
 */
export function isGeneratedHero(item: DiscoveredItem): boolean {
  return item.media?.source === 'generated' || item.media?.license === 'generated'
}