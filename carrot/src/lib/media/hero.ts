import { DiscoveredItem } from '@/types/discovered-content'

/**
 * Picks the best available hero image for a discovered item.
 * Returns null if no real media exists (will trigger GeneratedCover).
 * NEVER returns text monograms or letter-based placeholders.
 */
export function pickHero(item: DiscoveredItem): string | null {
  const m = item.media || {}
  
  // Priority order: hero image, video thumbnail, PDF preview, first gallery image
  return m.hero || m.videoThumb || m.pdfPreview || (m.gallery?.[0] ?? null)
}

/**
 * Gets the highest quality YouTube thumbnail
 */
export function getYouTubeThumbnail(videoId: string): string {
  // Try maxresdefault first (1920x1080), fallback to hqdefault (480x360)
  return `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`
}

/**
 * Gets Vimeo thumbnail URL
 */
export function getVimeoThumbnail(videoId: string): string {
  // For Vimeo, you'd typically need to call their API
  // For now, return a placeholder that should be replaced by the serializer
  return `https://vumbnail.com/${videoId}.jpg`
}

/**
 * Extracts video ID from YouTube URL
 */
export function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/,
    /youtube\.com\/embed\/([^&\s]+)/,
  ]
  
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match && match[1]) return match[1]
  }
  
  return null
}

/**
 * Extracts video ID from Vimeo URL
 */
export function extractVimeoId(url: string): string | null {
  const match = url.match(/vimeo\.com\/(\d+)/)
  return match ? match[1] : null
}

