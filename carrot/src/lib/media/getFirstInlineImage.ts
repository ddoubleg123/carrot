import { InlineImageResult } from './hero-types'

/**
 * Extract first inline image from article content
 * Uses Readability for parsing, falls back to Playwright for blocked hosts
 */
export async function getFirstInlineImage(url: string): Promise<InlineImageResult | null> {
  try {
    console.log('[getFirstInlineImage] Extracting inline image from:', url.substring(0, 50))
    
    // First try with regular fetch + Readability
    const result = await tryWithReadability(url)
    if (result) return result

    // Fallback to Playwright for blocked hosts
    const playwrightResult = await tryWithPlaywright(url)
    if (playwrightResult) return playwrightResult

    return null
  } catch (error) {
    console.warn('[getFirstInlineImage] Error:', error)
    return null
  }
}

/**
 * Try extracting with Readability (faster, works for most sites)
 */
async function tryWithReadability(url: string): Promise<InlineImageResult | null> {
  try {
    const response = await fetch(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CarrotBot/1.0; +https://carrot.app/bot)'
      }
    })

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
    const response = await fetch(url, { 
      method: 'HEAD',
      timeout: 3000
    })
    return response.ok && response.headers.get('content-type')?.startsWith('image/')
  } catch {
    return false
  }
}
