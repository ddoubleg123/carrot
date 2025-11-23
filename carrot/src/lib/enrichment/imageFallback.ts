/**
 * Resilient image fallback chain for hero images
 * Order: OpenGraph → article image → Wikipedia → domain favicon → placeholder
 * Never throws - always returns a valid image URL
 */

import { getOpenGraphImage } from '@/lib/media/getOpenGraphImage'
import { getFirstInlineImage } from '@/lib/media/getFirstInlineImage'

export interface ImageFallbackResult {
  url: string
  source: 'og' | 'article' | 'wikipedia' | 'favicon' | 'placeholder'
  width?: number
  height?: number
}

/**
 * Extract Wikipedia image from infobox (for en.wikipedia.org domains)
 */
async function tryWikipediaImage(url: string, html?: string): Promise<string | null> {
  try {
    if (!url.includes('wikipedia.org')) {
      return null
    }
    
    // If HTML provided, try to extract infobox image
    if (html) {
      const infoboxMatch = html.match(/<img[^>]*class="[^"]*infobox[^"]*"[^>]*src="([^"]+)"/i)
      if (infoboxMatch?.[1]) {
        const imageUrl = infoboxMatch[1].startsWith('//') 
          ? `https:${infoboxMatch[1]}`
          : infoboxMatch[1].startsWith('/')
          ? `https://en.wikipedia.org${infoboxMatch[1]}`
          : infoboxMatch[1]
        return imageUrl
      }
    }
    
    return null
  } catch {
    return null
  }
}

/**
 * Get domain favicon via Google's favicon service
 */
function getDomainFavicon(domain: string): string {
  try {
    const cleanDomain = domain.replace(/^www\./, '').replace(/^https?:\/\//, '')
    return `https://www.google.com/s2/favicons?sz=128&domain=${encodeURIComponent(cleanDomain)}`
  } catch {
    return 'https://www.google.com/s2/favicons?sz=128&domain=example.com'
  }
}

/**
 * Generate a placeholder image URL
 */
function generatePlaceholder(title: string, domain?: string): string {
  const text = encodeURIComponent(title.substring(0, 30))
  const bgColor = '667eea'
  return `https://via.placeholder.com/800x400/${bgColor}/ffffff?text=${text}`
}

/**
 * Resilient image fallback chain
 * Never throws - always returns a valid image URL
 */
export async function pickImageFallback(params: {
  url: string
  domain?: string | null
  title?: string
  html?: string
}): Promise<ImageFallbackResult> {
  const { url, domain, title = 'Article', html } = params
  
  // 1. Try OpenGraph og:image
  try {
    const ogResult = await getOpenGraphImage(url)
    if (ogResult?.url) {
      return {
        url: ogResult.url,
        source: 'og',
        width: ogResult.width,
        height: ogResult.height
      }
    }
  } catch (error) {
    console.warn('[pickImageFallback] OpenGraph failed:', error)
  }
  
  // 2. Try prominent article image
  try {
    const inlineResult = await getFirstInlineImage(url)
    if (inlineResult?.url) {
      return {
        url: inlineResult.url,
        source: 'article',
        width: inlineResult.width,
        height: inlineResult.height
      }
    }
  } catch (error) {
    console.warn('[pickImageFallback] Article image extraction failed:', error)
  }
  
  // 3. Try Wikipedia infobox (if domain is wikipedia.org)
  try {
    if (url.includes('wikipedia.org')) {
      const wikiImage = await tryWikipediaImage(url, html)
      if (wikiImage) {
        return {
          url: wikiImage,
          source: 'wikipedia'
        }
      }
    }
  } catch (error) {
    console.warn('[pickImageFallback] Wikipedia image failed:', error)
  }
  
  // 4. Try domain favicon
  try {
    if (domain) {
      const faviconUrl = getDomainFavicon(domain)
      return {
        url: faviconUrl,
        source: 'favicon'
      }
    }
  } catch (error) {
    console.warn('[pickImageFallback] Favicon failed:', error)
  }
  
  // 5. Placeholder (always succeeds)
  return {
    url: generatePlaceholder(title, domain || undefined),
    source: 'placeholder'
  }
}

