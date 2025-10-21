/**
 * URL Canonicalization for Discovery System
 * Strips tracking parameters, normalizes hostnames, follows redirects
 */

export interface CanonicalizationResult {
  canonicalUrl: string
  originalUrl: string
  redirectChain: string[]
  finalDomain: string
}

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
    
    // Follow redirects (max 5 redirects)
    let redirectCount = 0;
    while (redirectCount < 5) {
      try {
        const response = await fetch(currentUrl, {
          method: 'HEAD',
          redirect: 'manual',
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; CarrotBot/1.0)'
          }
        });
        
        if (response.status === 301 || response.status === 302) {
          const location = response.headers.get('location');
          if (location) {
            currentUrl = new URL(location, currentUrl).toString();
            redirectChain.push(currentUrl);
            redirectCount++;
            continue;
          }
        }
        break;
      } catch (error) {
        // If HEAD fails, try GET
        try {
          const response = await fetch(currentUrl, {
            method: 'GET',
            redirect: 'manual',
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; CarrotBot/1.0)'
            }
          });
          
          if (response.status === 301 || response.status === 302) {
            const location = response.headers.get('location');
            if (location) {
              currentUrl = new URL(location, currentUrl).toString();
              redirectChain.push(currentUrl);
              redirectCount++;
              continue;
            }
          }
          break;
        } catch {
          break;
        }
      }
    }
    
    // Normalize the final URL
    const url = new URL(currentUrl);
    
    // Remove fragment
    url.hash = '';
    
    // Normalize hostname
    url.hostname = url.hostname.replace(/^www\./, '').toLowerCase();
    
    // Remove tracking parameters
    const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid', 'gclsrc'];
    trackingParams.forEach(param => {
      url.searchParams.delete(param);
    });
    
    // Sort parameters for consistency
    const sortedParams = Array.from(url.searchParams.entries())
      .sort(([a], [b]) => a.localeCompare(b));
    
    url.search = sortedParams
      .map(([key, value]) => `${key}=${value}`)
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
 * Check if two URLs are equivalent after canonicalization
 */
export async function urlsAreEquivalent(url1: string, url2: string): Promise<boolean> {
  try {
    const [canon1, canon2] = await Promise.all([
      canonicalize(url1),
      canonicalize(url2)
    ]);
    return canon1.canonicalUrl === canon2.canonicalUrl;
  } catch {
    return false;
  }
}

/**
 * Extract domain from URL for grouping and analysis
 */
export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return 'unknown';
  }
}