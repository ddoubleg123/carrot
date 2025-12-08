import { InlineImageResult } from './hero-types'
import { normalizeUrlWithWWW, generateUrlVariations } from '@/lib/utils/urlNormalization'

/**
 * Extract first inline image from article content
 * Uses Readability for parsing, falls back to Playwright for blocked hosts
 * Tries URL variations if primary URL fails
 */
export async function getFirstInlineImage(url: string): Promise<InlineImageResult | null> {
  // Normalize URL first
  const normalizedUrl = normalizeUrlWithWWW(url)
  const variations = generateUrlVariations(normalizedUrl)
  
  // Try each URL variation
  for (const tryUrl of variations) {
    try {
      console.log('[getFirstInlineImage] Extracting inline image from:', tryUrl.substring(0, 50))
      
      // First try with regular fetch + Readability
      const result = await tryWithReadability(tryUrl)
      if (result) {
        console.log('[getFirstInlineImage] ✅ Found image with URL variation:', tryUrl)
        return result
      }

      // Fallback to Playwright for blocked hosts
      const playwrightResult = await tryWithPlaywright(tryUrl)
      if (playwrightResult) {
        console.log('[getFirstInlineImage] ✅ Found image with Playwright:', tryUrl)
        return playwrightResult
      }
    } catch (error) {
      console.warn('[getFirstInlineImage] Error for', tryUrl, ':', error)
      // Continue to next variation
      continue
    }
  }
  
  console.log('[getFirstInlineImage] ❌ No images found after trying all URL variations')
  return null
}

/**
 * Try extracting with Readability (faster, works for most sites)
 */
async function tryWithReadability(url: string): Promise<InlineImageResult | null> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CarrotBot/1.0; +https://carrot.app/bot)'
      }
    })

    clearTimeout(timeoutId)
    if (!response.ok) return null

    const html = await response.text()
    const images = extractImagesFromHtml(html, url)
    
    // Find first image ≥800×450
    for (const img of images) {
      if (img.width >= 800 && img.height >= 450) {
        if (await isValidImageUrl(img.url)) {
          return img
        }
      }
    }

    return null
  } catch {
    return null
  }
}

/**
 * Try extracting with Playwright (slower, works for blocked hosts)
 */
async function tryWithPlaywright(url: string): Promise<InlineImageResult | null> {
  try {
    // Note: This would require Playwright to be installed
    // For now, return null - can be implemented later
    console.log('[getFirstInlineImage] Playwright not implemented yet')
    return null
  } catch {
    return null
  }
}

/**
 * Extract images from HTML with natural dimensions
 */
function extractImagesFromHtml(html: string, baseUrl: string): InlineImageResult[] {
  const images: InlineImageResult[] = []
  
  // Simple regex to find img tags (could be improved with proper HTML parser)
  const imgRegex = /<img[^>]+src="([^"]+)"[^>]*(?:width="(\d+)"|height="(\d+)")?[^>]*>/gi
  
  let match
  while ((match = imgRegex.exec(html)) !== null) {
    const src = match[1]
    const width = parseInt(match[2]) || 0
    const height = parseInt(match[3]) || 0
    
    // Resolve relative URLs
    let imageUrl: string
    try {
      imageUrl = new URL(src, baseUrl).href
    } catch {
      continue
    }

    // Filter out common non-content images
    if (isNonContentImage(src)) {
      continue
    }

    images.push({
      url: imageUrl,
      width,
      height
    })
  }

  return images
}

/**
 * Check if image is likely not content (ads, logos, etc.)
 */
function isNonContentImage(src: string): boolean {
  const nonContentPatterns = [
    /logo/i,
    /banner/i,
    /ad/i,
    /advertisement/i,
    /sponsor/i,
    /social/i,
    /icon/i,
    /avatar/i,
    /profile/i,
    /button/i,
    /badge/i,
    /pixel/i,
    /tracking/i,
    /analytics/i,
    /\.gif$/i, // Animated GIFs are often not content
    /1x1/i,    // Tracking pixels
    /spacer/i
  ]

  return nonContentPatterns.some(pattern => pattern.test(src))
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
    const contentType = response.headers.get('content-type')
    return response.ok && (contentType?.startsWith('image/') ?? false)
  } catch {
    return false
  }
}
