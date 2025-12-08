/**
 * URL normalization utilities for hero image generation
 * Handles common URL issues like missing "www" prefix
 */

/**
 * Domains that typically require "www" prefix
 * These domains often fail without www but work with it
 */
const DOMAINS_REQUIRING_WWW = new Set([
  'jewishvirtuallibrary.org',
  'us-israel.org',
  // Add more domains as discovered
])

/**
 * Normalize URL by adding "www" prefix if domain requires it
 * Returns the normalized URL
 */
export function normalizeUrlWithWWW(url: string): string {
  try {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname.toLowerCase()
    
    // Check if domain requires www and doesn't have it
    if (!hostname.startsWith('www.') && DOMAINS_REQUIRING_WWW.has(hostname)) {
      urlObj.hostname = `www.${hostname}`
      return urlObj.href
    }
    
    return url
  } catch {
    // If URL parsing fails, return original
    return url
  }
}

/**
 * Generate URL variations to try as fallbacks
 * Returns array of URLs to try in order: [original, with-www, without-www, http-version]
 */
export function generateUrlVariations(url: string): string[] {
  const variations: string[] = [url] // Start with original
  
  try {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname.toLowerCase()
    const protocol = urlObj.protocol
    
    // Variation 1: Add www if missing
    if (!hostname.startsWith('www.')) {
      urlObj.hostname = `www.${hostname}`
      variations.push(urlObj.href)
      urlObj.hostname = hostname // Reset for next variation
    }
    
    // Variation 2: Remove www if present
    if (hostname.startsWith('www.')) {
      urlObj.hostname = hostname.replace(/^www\./, '')
      variations.push(urlObj.href)
      urlObj.hostname = hostname // Reset for next variation
    }
    
    // Variation 3: Try http if https
    if (protocol === 'https:') {
      urlObj.protocol = 'http:'
      variations.push(urlObj.href)
    }
    
    // Variation 4: Try https if http
    if (protocol === 'http:') {
      urlObj.protocol = 'https:'
      variations.push(urlObj.href)
    }
    
    // Remove duplicates
    return Array.from(new Set(variations))
  } catch {
    return [url] // If parsing fails, just return original
  }
}

/**
 * Try fetching a URL with fallback variations
 * Returns the first successful response or null
 */
export async function fetchWithUrlFallback(
  url: string,
  fetchFn: (url: string) => Promise<Response>
): Promise<{ response: Response; finalUrl: string } | null> {
  const variations = generateUrlVariations(url)
  
  for (const variation of variations) {
    try {
      const response = await fetchFn(variation)
      if (response.ok) {
        return { response, finalUrl: variation }
      }
    } catch (error) {
      // Continue to next variation
      continue
    }
  }
  
  return null
}

