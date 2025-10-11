import { DiscoveredItem } from '@/types/discovered-content'

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
  console.log('[pickHero] No real media found, returning null for GeneratedCover fallback')
  return null
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