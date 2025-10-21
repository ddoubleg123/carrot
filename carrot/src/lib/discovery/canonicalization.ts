/**
 * URL Canonicalization Utility
 * 
 * Normalizes URLs to ensure consistent deduplication by:
 * - Lowercasing hostname and removing www
 * - Removing fragments (#)
 * - Stripping UTM parameters
 * - Normalizing query parameter order
 * - Following one redirect hop
 */

export interface CanonicalizationResult {
  canonicalUrl: string;
  originalUrl: string;
  redirectChain: string[];
  finalDomain: string;
}

/**
 * Canonicalize a URL for deduplication
 */
export async function canonicalize(rawUrl: string): Promise<CanonicalizationResult> {
  const originalUrl = rawUrl;
  const redirectChain: string[] = [];
  
  try {
    // Start with the original URL
    let currentUrl = rawUrl;
    redirectChain.push(currentUrl);
    
    // Handle relative URLs by resolving them against Wikipedia base
    if (currentUrl.startsWith('./') || currentUrl.startsWith('../') || (!currentUrl.startsWith('http'))) {
      // This is likely a Wikipedia relative URL, resolve it against Wikipedia base
      currentUrl = `https://en.wikipedia.org${currentUrl.startsWith('/') ? '' : '/'}${currentUrl}`;
      redirectChain.push(currentUrl);
    }
    
    // Follow one redirect hop
    const redirectResult = await followRedirect(currentUrl);
    if (redirectResult.redirected && redirectResult.finalUrl) {
      currentUrl = redirectResult.finalUrl;
      redirectChain.push(currentUrl);
    }
    
    // Parse and normalize the URL
    const url = new URL(currentUrl);
    
    // Normalize hostname: lowercase and remove www
    url.hostname = url.hostname.replace(/^www\./, '').toLowerCase();
    
    // Remove fragment
    url.hash = '';
    
    // Remove UTM and tracking parameters
    const utmParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid', 'ref'];
    utmParams.forEach(param => url.searchParams.delete(param));
    
    // Sort query parameters for consistency
    const sortedParams = Array.from(url.searchParams.entries())
      .sort(([a], [b]) => a.localeCompare(b));
    
    url.search = sortedParams
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');
    
    const canonicalUrl = url.toString();
    const finalDomain = url.hostname;
    
    return {
      canonicalUrl,
      originalUrl,
      redirectChain,
      finalDomain
    };
    
  } catch (error) {
    console.warn(`[Canonicalization] Failed to canonicalize URL: ${rawUrl}`, error);
    
    // Handle relative URLs in fallback case
    let fallbackUrl = rawUrl;
    if (rawUrl.startsWith('./') || rawUrl.startsWith('../') || (!rawUrl.startsWith('http'))) {
      fallbackUrl = `https://en.wikipedia.org${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`;
    }
    
    // Return original URL as fallback
    return {
      canonicalUrl: fallbackUrl,
      originalUrl,
      redirectChain,
      finalDomain: fallbackUrl.startsWith('http') ? new URL(fallbackUrl).hostname : 'unknown'
    };
  }
}

/**
 * Follow one redirect hop (301/302)
 */
async function followRedirect(url: string): Promise<{ redirected: boolean; finalUrl?: string }> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'manual',
      signal: AbortSignal.timeout(3000) // 3 second timeout
    });
    
    if (response.status === 301 || response.status === 302) {
      const location = response.headers.get('location');
      if (location) {
        return {
          redirected: true,
          finalUrl: location
        };
      }
    }
    
    return { redirected: false };
  } catch (error) {
    // If redirect check fails, continue with original URL
    return { redirected: false };
  }
}

/**
 * Extract domain from URL for diversity tracking
 */
export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return 'unknown';
  }
}

/**
 * Check if URL is likely a duplicate based on path similarity
 */
export function isPathSimilar(url1: string, url2: string): boolean {
  try {
    const u1 = new URL(url1);
    const u2 = new URL(url2);
    
    // Same domain and very similar path
    if (u1.hostname === u2.hostname) {
      const path1 = u1.pathname.toLowerCase();
      const path2 = u2.pathname.toLowerCase();
      
      // Exact path match
      if (path1 === path2) return true;
      
      // Very similar paths (one is subset of other)
      if (path1.includes(path2) || path2.includes(path1)) {
        return true;
      }
    }
    
    return false;
  } catch {
    return false;
  }
}

/**
 * Generate a content fingerprint key for caching
 */
export function generateContentKey(url: string, content: string): string {
  const domain = extractDomain(url);
  const contentHash = simpleHash(content);
  return `${domain}:${contentHash}`;
}

/**
 * Simple hash function for content fingerprinting
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}
