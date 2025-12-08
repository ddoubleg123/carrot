import ogs from 'open-graph-scraper'
import { OpenGraphResult } from './hero-types'
import { normalizeUrlWithWWW, generateUrlVariations } from '@/lib/utils/urlNormalization'

/**
 * Extract Open Graph or Twitter Card image from URL
 * Priority: og:image → twitter:image → og:image:secure_url
 * Tries URL variations (with/without www) if primary URL fails
 */
export async function getOpenGraphImage(url: string): Promise<OpenGraphResult | null> {
  // Normalize URL first
  const normalizedUrl = normalizeUrlWithWWW(url)
  const variations = generateUrlVariations(normalizedUrl)
  
  // Try each URL variation
  for (const tryUrl of variations) {
    try {
      console.log('[getOpenGraphImage] Fetching OG data for:', tryUrl.substring(0, 50))
      
      const options = {
        url: tryUrl,
        fetchOptions: {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; CarrotBot/1.0; +https://carrot.app/bot)'
          },
          signal: AbortSignal.timeout(8000) // Reduced from 10s to fail faster
        }
      }

      const { result } = await ogs(options)
    
      if (!result.success) {
        console.log('[getOpenGraphImage] OG fetch failed for', tryUrl, ':', result.error)
        continue // Try next variation
      }

      // Priority order: og:image → twitter:image
      const candidates = [
        result.ogImage?.[0]?.url,
        result.twitterImage?.[0]?.url
      ].filter(Boolean) as string[]

      for (const imageUrl of candidates) {
        if (await isValidImageUrl(imageUrl)) {
          console.log('[getOpenGraphImage] ✅ Found valid OG image:', imageUrl.substring(0, 50))
          return {
            url: imageUrl,
            source: 'og',
            width: result.ogImage?.[0]?.width,
            height: result.ogImage?.[0]?.height
          }
        }
      }

      // If we got here, OG fetch succeeded but no valid images found
      // Continue to try other variations in case they have images
      continue
    } catch (error) {
      console.warn('[getOpenGraphImage] Error for', tryUrl, ':', error)
      // Continue to next variation
      continue
    }
  }
  
  // All variations failed
  console.log('[getOpenGraphImage] ❌ No valid OG images found after trying all URL variations')
  return null
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
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)
    
    const response = await fetch(url, { 
      method: 'HEAD',
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)
    if (!response.ok) {
      return false
    }

    const contentType = response.headers.get('content-type')
    return contentType?.startsWith('image/') ?? false
  } catch {
    return false
  }
}
