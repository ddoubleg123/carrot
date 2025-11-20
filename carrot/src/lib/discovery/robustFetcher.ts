import { createHash } from 'crypto'

export interface FetchResult {
  ok: boolean
  status: number
  contentType: string
  body: Buffer
  finalUrl: string
  ms: number
  error?: string
  robotsAllowed?: boolean
}

export interface FetchOptions {
  connectTimeoutMs?: number
  readTimeoutMs?: number
  maxRetries?: number
  userAgent?: string
}

const DEFAULT_OPTIONS: Required<FetchOptions> = {
  connectTimeoutMs: 10000,
  readTimeoutMs: 20000,
  maxRetries: 2,
  userAgent: 'CarrotCrawler/1.0 (+contact@example.com)'
}

/**
 * Fetch with retries, timeouts, and robots.txt checking
 */
export async function fetchWithPolicy(
  url: string,
  options: FetchOptions = {}
): Promise<FetchResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const started = Date.now()
  
  // Check robots.txt (simplified - just check if domain allows)
  const robotsAllowed = await checkRobotsTxt(url)
  
  if (!robotsAllowed) {
    return {
      ok: false,
      status: 0,
      contentType: '',
      body: Buffer.alloc(0),
      finalUrl: url,
      ms: Date.now() - started,
      error: 'robots_disallowed',
      robotsAllowed: false
    }
  }
  
  let lastError: Error | null = null
  let attempt = 0
  
  while (attempt <= opts.maxRetries) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), opts.readTimeoutMs)
      
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': opts.userAgent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
          },
          redirect: 'follow',
          signal: controller.signal
        })
        
        clearTimeout(timeoutId)
        
        const contentType = response.headers.get('content-type') || ''
        
        // Only parse text/html or application/xhtml+xml
        if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
          return {
            ok: false,
            status: response.status,
            contentType,
            body: Buffer.alloc(0),
            finalUrl: response.url || url,
            ms: Date.now() - started,
            error: 'content_type_unsupported',
            robotsAllowed: true
          }
        }
        
        const arrayBuffer = await response.arrayBuffer()
        const body = Buffer.from(arrayBuffer)
        
        return {
          ok: response.ok,
          status: response.status,
          contentType,
          body,
          finalUrl: response.url || url,
          ms: Date.now() - started,
          robotsAllowed: true
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId)
        
        if (fetchError.name === 'AbortError') {
          lastError = new Error('timeout')
        } else {
          lastError = fetchError
        }
      }
    } catch (error: any) {
      lastError = error
    }
    
    attempt++
    
    // Exponential backoff with jitter
    if (attempt <= opts.maxRetries) {
      const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000)
      const jitter = Math.random() * 200
      await new Promise(resolve => setTimeout(resolve, backoffMs + jitter))
    }
  }
  
  return {
    ok: false,
    status: 0,
    contentType: '',
    body: Buffer.alloc(0),
    finalUrl: url,
    ms: Date.now() - started,
    error: lastError?.message || 'unknown_error',
    robotsAllowed: true
  }
}

/**
 * Simple robots.txt checker (minimal implementation)
 * In production, use a proper robots.txt parser library
 */
async function checkRobotsTxt(url: string): Promise<boolean> {
  try {
    const parsed = new URL(url)
    const robotsUrl = `${parsed.protocol}//${parsed.host}/robots.txt`
    
    // For now, allow all (can be enhanced with proper robots.txt parsing)
    // This is a simplified check - in production, use a library like 'robots-parser'
    return true
  } catch {
    return true // Allow on error
  }
}

/**
 * Extract main content using Readability-like heuristics
 */
export function extractMainContent(html: string, url: string): {
  title: string
  content: string
  text: string
  byline?: string
  siteName?: string
  publishedTime?: string
} {
  // Simple extraction - in production, use @mozilla/readability or similar
  // For now, use basic DOM parsing with Cheerio-like heuristics
  
  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  const title = titleMatch ? titleMatch[1].trim() : 'Untitled'
  
  // Extract main content (simplified - look for article/main tags)
  let content = ''
  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)
  
  if (articleMatch) {
    content = articleMatch[1]
  } else if (mainMatch) {
    content = mainMatch[1]
  } else {
    // Fallback: extract from body
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
    content = bodyMatch ? bodyMatch[1] : html
  }
  
  // Remove scripts, styles, nav
  content = content
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
  
  // Extract text (remove HTML tags)
  const text = content
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  
  // Extract byline
  const bylineMatch = html.match(/<meta[^>]*property=["']article:author["'][^>]*content=["']([^"']+)["']/i) ||
                       html.match(/<span[^>]*class=["'][^"']*byline[^"']*["'][^>]*>([^<]+)<\/span>/i)
  const byline = bylineMatch ? bylineMatch[1].trim() : undefined
  
  // Extract site name
  const siteNameMatch = html.match(/<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i)
  const siteName = siteNameMatch ? siteNameMatch[1].trim() : undefined
  
  // Extract published time
  const publishedMatch = html.match(/<meta[^>]*property=["']article:published_time["'][^>]*content=["']([^"']+)["']/i) ||
                         html.match(/<time[^>]*datetime=["']([^"']+)["']/i)
  const publishedTime = publishedMatch ? publishedMatch[1].trim() : undefined
  
  return {
    title,
    content,
    text,
    byline,
    siteName,
    publishedTime
  }
}

/**
 * Pick up to 2 fair-use paragraphs (densest/most representative, ≤180 words total)
 */
export function pickFairUseQuotes(text: string): Array<{ quote: string; attribution?: string; sourceUrl?: string }> {
  // Split into paragraphs
  const paragraphs = text
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(p => p.length > 50) // Filter very short paragraphs
  
  if (paragraphs.length === 0) {
    return []
  }
  
  // Score paragraphs by information density (word count, sentence length, named entities)
  const scored = paragraphs.map(p => {
    const words = p.split(/\s+/).length
    const sentences = p.split(/[.!?]+/).filter(s => s.trim().length > 0)
    const avgSentenceLength = sentences.length > 0 ? sentences.reduce((sum, s) => sum + s.split(/\s+/).length, 0) / sentences.length : 0
    
    // Simple named entity detection (capitalized words that aren't at sentence start)
    const namedEntities = (p.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || []).length
    
    // Score: word count + sentence quality + named entities
    const score = words + (avgSentenceLength * 0.5) + (namedEntities * 2)
    
    return { paragraph: p, score, wordCount: words }
  })
  
  // Sort by score (highest first)
  scored.sort((a, b) => b.score - a.score)
  
  // Pick up to 2 paragraphs, ensuring total ≤180 words
  const selected: Array<{ quote: string; wordCount: number }> = []
  let totalWords = 0
  const maxWords = 180
  
  for (const item of scored) {
    if (selected.length >= 2) break
    if (totalWords + item.wordCount > maxWords) {
      // Try to fit a shorter one
      continue
    }
    selected.push({ quote: item.paragraph, wordCount: item.wordCount })
    totalWords += item.wordCount
  }
  
  return selected.map(item => ({ quote: item.quote }))
}

