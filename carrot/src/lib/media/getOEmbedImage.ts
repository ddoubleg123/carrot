import { OpenGraphResult } from './hero-types'

/**
 * Extract image from oEmbed providers (YouTube, Vimeo, Twitter, etc.)
 */
export async function getOEmbedImage(url: string): Promise<OpenGraphResult | null> {
  try {
    console.log('[getOEmbedImage] Trying oEmbed for:', url.substring(0, 50))
    
    // YouTube
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      return await getYouTubeThumbnail(url)
    }

    // Vimeo
    if (url.includes('vimeo.com')) {
      return await getVimeoThumbnail(url)
    }

    // Twitter/X
    if (url.includes('twitter.com') || url.includes('x.com')) {
      return await getTwitterThumbnail(url)
    }

    // Try generic oEmbed
    return await getGenericOEmbed(url)
  } catch (error) {
    console.warn('[getOEmbedImage] Error:', error)
    return null
  }
}

/**
 * Extract YouTube thumbnail using their thumbnail API
 */
async function getYouTubeThumbnail(url: string): Promise<OpenGraphResult | null> {
  try {
    // Extract video ID from YouTube URL
    const videoId = extractYouTubeVideoId(url)
    if (!videoId) return null

    // Try different thumbnail qualities
    const thumbnailUrls = [
      `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`, // 1280x720
      `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,     // 480x360
      `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,     // 320x180
    ]

    for (const thumbnailUrl of thumbnailUrls) {
      if (await isValidImageUrl(thumbnailUrl)) {
        return {
          url: thumbnailUrl,
          source: 'oembed'
        }
      }
    }

    return null
  } catch {
    return null
  }
}

/**
 * Extract Vimeo thumbnail
 */
async function getVimeoThumbnail(url: string): Promise<OpenGraphResult | null> {
  try {
    const videoId = extractVimeoVideoId(url)
    if (!videoId) return null

    // Vimeo oEmbed API
    const oembedUrl = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)
    
    const response = await fetch(oembedUrl, { signal: controller.signal })
    
    clearTimeout(timeoutId)
    if (!response.ok) return null
    
    const data = await response.json()
    const thumbnailUrl = data.thumbnail_url

    if (thumbnailUrl && await isValidImageUrl(thumbnailUrl)) {
      return {
        url: thumbnailUrl,
        source: 'oembed'
      }
    }

    return null
  } catch {
    return null
  }
}

/**
 * Extract Twitter thumbnail
 */
async function getTwitterThumbnail(url: string): Promise<OpenGraphResult | null> {
  try {
    // Twitter oEmbed API
    const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}`
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)
    
    const response = await fetch(oembedUrl, { signal: controller.signal })
    
    clearTimeout(timeoutId)
    if (!response.ok) return null
    
    const data = await response.json()
    
    // Extract image from HTML
    const html = data.html
    const imgMatch = html.match(/<img[^>]+src="([^"]+)"/)
    
    if (imgMatch && imgMatch[1]) {
      const imageUrl = imgMatch[1]
      if (await isValidImageUrl(imageUrl)) {
        return {
          url: imageUrl,
          source: 'oembed'
        }
      }
    }

    return null
  } catch {
    return null
  }
}

/**
 * Try generic oEmbed
 */
async function getGenericOEmbed(url: string): Promise<OpenGraphResult | null> {
  try {
    // Try common oEmbed endpoints
    const oembedEndpoints = [
      `https://oembed.com/providers.json`, // Get providers first
      // Could implement provider discovery here
    ]

    // For now, just return null - could be expanded
    return null
  } catch {
    return null
  }
}

/**
 * Extract YouTube video ID from various YouTube URL formats
 */
function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/,
    /youtube\.com\/embed\/([^&\s]+)/,
    /youtube\.com\/v\/([^&\s]+)/,
  ]
  
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match && match[1]) return match[1]
  }
  
  return null
}

/**
 * Extract Vimeo video ID from Vimeo URL
 */
function extractVimeoVideoId(url: string): string | null {
  const match = url.match(/vimeo\.com\/(\d+)/)
  return match ? match[1] : null
}

/**
 * Validate that an image URL is accessible
 */
async function isValidImageUrl(url: string): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3000)
    
    const response = await fetch(url, { 
      method: 'HEAD',
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)
    return response.ok && response.headers.get('content-type')?.startsWith('image/')
  } catch {
    return false
  }
}
