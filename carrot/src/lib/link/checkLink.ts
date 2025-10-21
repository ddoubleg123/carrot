/**
 * Link verification utilities with Wayback fallback
 */

export interface LinkStatus {
  verified: boolean
  status: number
  finalUrl: string
  lastChecked: string
  waybackUrl?: string
  error?: string
}

/**
 * Check if a link is accessible
 */
export async function checkLink(url: string, timeout: number = 5000): Promise<LinkStatus> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)
  
  try {
    // Try HEAD request first
    let response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CarrotLinkChecker/1.0)'
      },
      redirect: 'follow'
    })
    
    clearTimeout(timeoutId)
    
    // If HEAD not allowed, try GET
    if (response.status === 405 || response.status === 501) {
      const getController = new AbortController()
      const getTimeoutId = setTimeout(() => getController.abort(), timeout)
      
      response = await fetch(url, {
        method: 'GET',
        signal: getController.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; CarrotLinkChecker/1.0)'
        },
        redirect: 'follow'
      })
      
      clearTimeout(getTimeoutId)
    }
    
    const verified = response.ok && response.status >= 200 && response.status < 400
    const result: LinkStatus = {
      verified,
      status: response.status,
      finalUrl: response.url,
      lastChecked: new Date().toISOString()
    }
    
    // If link is broken, add Wayback fallback
    if (!verified) {
      result.waybackUrl = `https://web.archive.org/web/*/${encodeURIComponent(url)}`
      
      // Fire-and-forget archive request
      fetch(`https://web.archive.org/save/${encodeURIComponent(url)}`, {
        method: 'GET'
      }).catch(() => {
        // Ignore archive errors
      })
    }
    
    return result
    
  } catch (error: any) {
    clearTimeout(timeoutId)
    
    return {
      verified: false,
      status: 0,
      finalUrl: url,
      lastChecked: new Date().toISOString(),
      waybackUrl: `https://web.archive.org/web/*/${encodeURIComponent(url)}`,
      error: error.message
    }
  }
}

/**
 * Check multiple links in parallel
 */
export async function checkLinks(urls: string[], concurrency: number = 5): Promise<Map<string, LinkStatus>> {
  const results = new Map<string, LinkStatus>()
  const chunks: string[][] = []
  
  // Split URLs into chunks for parallel processing
  for (let i = 0; i < urls.length; i += concurrency) {
    chunks.push(urls.slice(i, i + concurrency))
  }
  
  // Process chunks sequentially, URLs within chunk in parallel
  for (const chunk of chunks) {
    const promises = chunk.map(url => checkLink(url))
    const chunkResults = await Promise.all(promises)
    
    chunk.forEach((url, index) => {
      results.set(url, chunkResults[index])
    })
  }
  
  return results
}

/**
 * Check if a link status is stale and needs re-verification
 */
export function isStatusStale(lastChecked: string, maxAgeHours: number = 24): boolean {
  try {
    const lastCheckedDate = new Date(lastChecked)
    const now = new Date()
    const ageHours = (now.getTime() - lastCheckedDate.getTime()) / (1000 * 60 * 60)
    
    return ageHours > maxAgeHours
  } catch {
    return true
  }
}

/**
 * Get Wayback Machine snapshot URL
 */
export function getWaybackUrl(url: string, timestamp?: string): string {
  if (timestamp) {
    return `https://web.archive.org/web/${timestamp}/${url}`
  }
  return `https://web.archive.org/web/*/${encodeURIComponent(url)}`
}

/**
 * Request Wayback Machine to archive a URL
 */
export async function requestArchive(url: string): Promise<boolean> {
  try {
    const response = await fetch(`https://web.archive.org/save/${encodeURIComponent(url)}`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CarrotArchiver/1.0)'
      }
    })
    
    return response.ok
  } catch {
    return false
  }
}
