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

const TRACKING_PARAM_REGEX = /^(utm_|icid|ncid|igshid)/i
const IGNORED_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'gclid',
  'gclsrc',
  'fbclid',
  'mc_cid',
  'mc_eid'
])

/**
 * Lightweight, synchronous canonicalization used for fast duplicate checks.
 * Normalises host casing, strips common tracking params, sorts remaining params,
 * and removes fragments without performing network I/O.
 */
export function canonicalizeUrlFast(rawUrl: string | null | undefined): string {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return ''
  }

  const trimmed = rawUrl.trim()
  if (!trimmed) {
    return ''
  }

  try {
    const hasProtocol = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)
    const resolved = hasProtocol ? trimmed : `https://${trimmed.replace(/^\/\//, '')}`
    const url = new URL(resolved)

    url.hash = ''
    url.hostname = url.hostname.replace(/^www\./, '').toLowerCase()
    // Normalise common variant paths
    url.pathname = url.pathname
      .replace(/\/amp(\/|$)/i, '/')
      .replace(/\/mobile(\/|$)/i, '/')
      .replace(/\/print(\/|$)/i, '/')
      .replace(/\/m\//i, '/')

    const entries: [string, string][] = []
    url.searchParams.forEach((value, key) => {
      if (IGNORED_PARAMS.has(key) || TRACKING_PARAM_REGEX.test(key)) {
        return
      }
      entries.push([key, value])
    })

    entries.sort(([a], [b]) => a.localeCompare(b))

    const search = entries.map(([key, value]) => `${key}=${value}`).join('&')
    url.search = search

    // Remove default ports
    if ((url.protocol === 'http:' && url.port === '80') || (url.protocol === 'https:' && url.port === '443')) {
      url.port = ''
    }

    return url.toString()
  } catch {
    return rawUrl
  }
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
    const normalizedUrl = canonicalizeUrlFast(currentUrl)
    const finalDomain = extractDomain(normalizedUrl);
    
    return {
      canonicalUrl: normalizedUrl,
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
    const normalizedFallback = canonicalizeUrlFast(fallbackUrl)
    return {
      canonicalUrl: normalizedFallback,
      originalUrl,
      redirectChain,
      finalDomain: normalizedFallback.startsWith('http') ? new URL(normalizedFallback).hostname : 'unknown'
    };
  }
}

/**
 * Extract domain from URL safely, returning null on parse failure.
 * Strips www. prefix and normalizes to lowercase.
 * 
 * @param url - URL string to extract domain from
 * @returns Domain string (without www) or null if parsing fails
 */
export function getDomainFromUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') {
    return null
  }

  try {
    // Handle relative URLs by assuming https://
    const hasProtocol = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url.trim())
    const resolved = hasProtocol ? url.trim() : `https://${url.trim().replace(/^\/\//, '')}`
    const urlObj = new URL(resolved)
    return urlObj.hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return null
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