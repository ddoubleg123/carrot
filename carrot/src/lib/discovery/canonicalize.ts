/**
 * Canonical URL normalization for deduplication
 * - Lowercase host, strip www, drop fragments, remove tracking params
 * - Sort query parameters for consistent URLs
 */

export interface CanonicalizationResult {
  canonicalUrl: string
  originalUrl: string
  domain: string
  path: string
  query: string
}

export function canonicalize(url: string): CanonicalizationResult {
  try {
    const originalUrl = url.trim()
    
    // Handle relative URLs
    if (originalUrl.startsWith('./') || originalUrl.startsWith('../') || !originalUrl.startsWith('http')) {
      throw new Error('Relative URL cannot be canonicalized')
    }
    
    const urlObj = new URL(originalUrl)
    
    // Normalize hostname (lowercase, strip www)
    const hostname = urlObj.hostname.toLowerCase().replace(/^www\./, '')
    
    // Remove fragment
    urlObj.hash = ''
    
    // Remove tracking parameters
    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'fbclid', 'gclid', 'gclsrc', 'dclid', 'msclkid',
      'ref', 'source', 'campaign', 'medium'
    ]
    
    trackingParams.forEach(param => {
      urlObj.searchParams.delete(param)
    })
    
    // Sort query parameters for consistency
    const sortedParams = Array.from(urlObj.searchParams.entries())
      .sort(([a], [b]) => a.localeCompare(b))
    
    urlObj.search = ''
    sortedParams.forEach(([key, value]) => {
      urlObj.searchParams.set(key, value)
    })
    
    const canonicalUrl = urlObj.toString()
    const domain = hostname
    const path = urlObj.pathname + urlObj.search
    
    return {
      canonicalUrl,
      originalUrl,
      domain,
      path,
      query: urlObj.search
    }
    
  } catch (error) {
    // Fallback for invalid URLs
    return {
      canonicalUrl: url.trim(),
      originalUrl: url.trim(),
      domain: 'unknown',
      path: '',
      query: ''
    }
  }
}

/**
 * Check if two URLs are equivalent after canonicalization
 */
export function urlsAreEquivalent(url1: string, url2: string): boolean {
  try {
    const canonical1 = canonicalize(url1)
    const canonical2 = canonicalize(url2)
    return canonical1.canonicalUrl === canonical2.canonicalUrl
  } catch {
    return false
  }
}

/**
 * Extract domain from URL for allowlist checking
 */
export function extractDomain(url: string): string {
  try {
    const canonical = canonicalize(url)
    return canonical.domain
  } catch {
    return 'unknown'
  }
}
