import ogs from 'open-graph-scraper'
import { OpenGraphResult } from './hero-types'

/**
 * Extract Open Graph or Twitter Card image from URL
 * Priority: og:image → twitter:image → og:image:secure_url
 */
export async function getOpenGraphImage(url: string): Promise<OpenGraphResult | null> {
  try {
    console.log('[getOpenGraphImage] Fetching OG data for:', url.substring(0, 50))
    
    const options = {
      url,
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CarrotBot/1.0; +https://carrot.app/bot)'
      }
    }

    const { result } = await ogs(options)
    
    if (!result.success) {
      console.log('[getOpenGraphImage] OG fetch failed:', result.error)
      return null
    }

    // Priority order: og:image → twitter:image → og:image:secure_url
    const candidates = [
      result.ogImage?.[0]?.url,
      result.twitterImage?.[0]?.url,
      result.ogImage?.[0]?.secureUrl
    ].filter(Boolean) as string[]

    for (const imageUrl of candidates) {
      if (await isValidImageUrl(imageUrl)) {
        console.log('[getOpenGraphImage] Found valid OG image:', imageUrl.substring(0, 50))
        return {
          url: imageUrl,
          source: 'og',
          width: result.ogImage?.[0]?.width,
          height: result.ogImage?.[0]?.height
        }
      }
    }

    console.log('[getOpenGraphImage] No valid OG images found')
    return null
  } catch (error) {
    console.warn('[getOpenGraphImage] Error:', error)
    return null
  }
}

/**
 * Validate that an image URL is accessible and returns an image
 */
async function isValidImageUrl(url: string): Promise<boolean> {
  try {
    // Basic URL validation
    new URL(url)
    
    // Check if it's a supported image format
    const supportedFormats = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg']
    const hasValidExtension = supportedFormats.some(format => 
      url.toLowerCase().includes(format)
    )
    
    if (!hasValidExtension) {
      return false
    }

    // Quick HEAD request to check if image is accessible
    const response = await fetch(url, { 
      method: 'HEAD',
      timeout: 5000
    })
    
    if (!response.ok) {
      return false
    }

    const contentType = response.headers.get('content-type')
    return contentType?.startsWith('image/') ?? false
  } catch {
    return false
  }
}
