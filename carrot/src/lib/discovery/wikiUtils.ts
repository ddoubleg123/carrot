import { canonicalizeUrlFast } from './canonicalize'

function normaliseUrl(candidate: string, source: string): string | null {
  try {
    if (!candidate.startsWith('http')) {
      return new URL(candidate, source).toString()
    }
    return new URL(candidate).toString()
  } catch {
    return null
  }
}

export interface WikipediaCitation {
  url: string
  title?: string
  context?: string
  text?: string
}

export function extractWikipediaReferences(
  html: string | undefined,
  sourceUrl: string,
  limit = 20
): string[] {
  const citations = extractWikipediaCitationsWithContext(html, sourceUrl, limit)
  return citations.map(c => c.url)
}

/**
 * Extract Wikipedia citations with title and context for prioritization
 */
export function extractWikipediaCitationsWithContext(
  html: string | undefined,
  sourceUrl: string,
  limit = 10000 // Extract ALL citations (very high limit)
): WikipediaCitation[] {
  if (!html) return []
  
  // Find references section
  const referencesMatch = html.match(/<ol[^>]*class="[^"]*references[^"]*"[^>]*>([\s\S]*?)<\/ol>/i)
  if (!referencesMatch) return []

  const refMatches = referencesMatch[1].match(/<li[^>]*>[\s\S]*?<\/li>/gi) || []
  if (!refMatches.length) return []

  const citations: WikipediaCitation[] = []
  for (const ref of refMatches) {
    // Extract URL
    const hrefMatch = ref.match(/href=["']([^"']+)["']/i)
    if (!hrefMatch) continue
    
    const normalised = normaliseUrl(hrefMatch[1], sourceUrl)
    if (!normalised) continue
    if (/wikipedia\.org/i.test(normalised)) continue
    
    const canonical = canonicalizeUrlFast(normalised)
    if (!canonical) continue
    
    // Check for duplicates
    if (citations.some(c => c.url === canonical)) continue
    
    // Extract title/text from citation
    // Look for <cite> tags, reference text, or link text
    const citeMatch = ref.match(/<cite[^>]*>([^<]+)<\/cite>/i)
    const textMatch = ref.match(/<span[^>]*class=["'][^"']*reference-text[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)
    const linkTextMatch = ref.match(/<a[^>]*>([^<]+)<\/a>/i)
    
    let title: string | undefined
    let context: string | undefined
    
    if (citeMatch) {
      title = citeMatch[1].replace(/<[^>]+>/g, '').trim()
    } else if (linkTextMatch) {
      title = linkTextMatch[1].replace(/<[^>]+>/g, '').trim()
    }
    
    if (textMatch) {
      context = textMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 200)
    }
    
    citations.push({
      url: canonical,
      title,
      context,
      text: title || context
    })
    
    if (citations.length >= limit) break
  }

  return citations
}

export interface OutgoingLinks {
  offHost: string[]
  sameHost: string[]
}

export function extractOutgoingLinks(
  html: string | undefined,
  sourceUrl: string,
  limit = 20
): OutgoingLinks {
  if (!html) {
    return { offHost: [], sameHost: [] }
  }

  let sourceHost: string | null = null
  try {
    sourceHost = new URL(sourceUrl).hostname.toLowerCase()
  } catch {
    sourceHost = null
  }

  const offHost: string[] = []
  const sameHost: string[] = []
  const anchorRegex = /<a[^>]+href=['"]([^'"#]+)['"][^>]*>/gi
  let match: RegExpExecArray | null

  while ((match = anchorRegex.exec(html))) {
    const direct = normaliseUrl(match[1], sourceUrl)
    if (!direct) continue
    const canonical = canonicalizeUrlFast(direct)
    if (!canonical) continue
    const host = (() => {
      try {
        return new URL(canonical).hostname.toLowerCase()
      } catch {
        return null
      }
    })()
    if (!host) continue
    if (host.includes('wikipedia.org')) continue
    if (host === sourceHost) {
      if (!sameHost.includes(canonical)) {
        sameHost.push(canonical)
      }
    } else if (!offHost.includes(canonical)) {
      offHost.push(canonical)
      if (offHost.length >= limit) break
    }
  }

  return {
    offHost,
    sameHost
  }
}
