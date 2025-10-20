/**
 * URL canonicalization utilities
 */

export function canonicalizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    
    // Remove UTM parameters
    const utmParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']
    utmParams.forEach(param => parsed.searchParams.delete(param))
    
    // Remove fragments
    parsed.hash = ''
    
    // Normalize host (remove www)
    if (parsed.hostname.startsWith('www.')) {
      parsed.hostname = parsed.hostname.substring(4)
    }
    
    return parsed.toString()
  } catch {
    return url
  }
}

export function getDomainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '')
  } catch {
    return url
  }
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}
