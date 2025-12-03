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
 * Extract ALL external URLs from Wikipedia page
 * Includes: References, Further reading, External links sections
 */
export function extractAllExternalUrls(
  html: string | undefined,
  sourceUrl: string
): WikipediaCitation[] {
  if (!html) return []
  
  const citations: WikipediaCitation[] = []
  const seenUrls = new Set<string>()
  
  // Wikipedia/Wikimedia domains to exclude
  const wikipediaDomains = [
    'wikipedia.org',
    'wikimedia.org',
    'wikidata.org',
    'wikiquote.org',
    'wikinews.org',
    'wikisource.org',
    'wikibooks.org',
    'wikiversity.org',
    'wiktionary.org',
    'commons.wikimedia.org',
    'upload.wikimedia.org'
  ]
  
  function isWikipediaUrl(url: string): boolean {
    try {
      const urlObj = new URL(url)
      const hostname = urlObj.hostname.toLowerCase().replace(/^www\./, '')
      return wikipediaDomains.some(domain => hostname.includes(domain))
    } catch {
      return false
    }
  }
  
  function addCitation(url: string, title?: string, context?: string, section?: string) {
    // Convert relative Wikipedia links to absolute URLs
    // e.g., ./History_of_South_Africa -> https://en.wikipedia.org/wiki/History_of_South_Africa
    let normalizedUrl = url
    if (url.startsWith('./')) {
      // Relative Wikipedia link - convert to absolute
      const pageName = url.replace('./', '').replace(/^\/wiki\//, '')
      normalizedUrl = `https://en.wikipedia.org/wiki/${pageName}`
    } else if (url.startsWith('/wiki/')) {
      // Absolute path Wikipedia link
      const pageName = url.replace('/wiki/', '')
      normalizedUrl = `https://en.wikipedia.org/wiki/${pageName}`
    } else {
      // Already absolute URL - normalize it
      const normalised = normaliseUrl(url, sourceUrl)
      if (!normalised) return
      normalizedUrl = normalised
    }
    
    const canonical = canonicalizeUrlFast(normalizedUrl)
    if (!canonical) return
    if (seenUrls.has(canonical)) return
    
    seenUrls.add(canonical)
    citations.push({
      url: canonical,
      title: title || undefined,
      context: context || section || undefined,
      text: title || context || section
    })
  }
  
  // 1. Extract from References section
  const referencesMatch = html.match(/<ol[^>]*class="[^"]*references[^"]*"[^>]*>([\s\S]*?)<\/ol>/i)
  if (referencesMatch) {
    const refMatches = referencesMatch[1].match(/<li[^>]*>[\s\S]*?<\/li>/gi) || []
    for (const ref of refMatches) {
      // Extract all URLs from this reference (including relative Wikipedia links)
      const urlMatches = ref.matchAll(/href=["']([^"']+)["']/gi)
      for (const urlMatch of urlMatches) {
        const url = urlMatch[1]
        // Include all URLs: http/https, relative Wikipedia links (./), and absolute paths (/wiki/)
        if (!url.startsWith('http') && !url.startsWith('//') && !url.startsWith('./') && !url.startsWith('/wiki/')) {
          continue
        }
        
        // Extract title/context
        const citeMatch = ref.match(/<cite[^>]*>([^<]+)<\/cite>/i)
        const textMatch = ref.match(/<span[^>]*class=["'][^"']*reference-text[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)
        const linkTextMatch = ref.match(/<a[^>]*href=["'][^"']*["'][^>]*>([^<]+)<\/a>/i)
        
        const title = citeMatch?.[1]?.replace(/<[^>]+>/g, '').trim() || 
                      linkTextMatch?.[1]?.replace(/<[^>]+>/g, '').trim()
        const context = textMatch?.[1]?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 200)
        
        addCitation(url, title, context, 'References')
      }
    }
  }
  
  // 1b. Extract relative Wikipedia links from main content (See also, Related articles, etc.)
  // These are often in "See also" sections or inline links
  const seeAlsoMatch = html.match(/<h2[^>]*>.*?See\s+also.*?<\/h2>([\s\S]*?)(?:<h2|$)/i)
  if (seeAlsoMatch) {
    const sectionHtml = seeAlsoMatch[1]
    const linkMatches = sectionHtml.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)
    for (const linkMatch of linkMatches) {
      const url = linkMatch[1]
      const linkText = linkMatch[2]?.replace(/<[^>]+>/g, '').trim()
      // Include relative Wikipedia links
      if (url.startsWith('./') || url.startsWith('/wiki/')) {
        addCitation(url, linkText, undefined, 'See also')
      }
    }
  }
  
  // 2. Extract from Further reading section
  const furtherReadingMatch = html.match(/<h2[^>]*>.*?Further\s+reading.*?<\/h2>([\s\S]*?)(?:<h2|$)/i)
  if (furtherReadingMatch) {
    const sectionHtml = furtherReadingMatch[1]
    const linkMatches = sectionHtml.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)
    for (const linkMatch of linkMatches) {
      const url = linkMatch[1]
      const linkText = linkMatch[2]?.replace(/<[^>]+>/g, '').trim()
      // Include all URLs: http/https, relative Wikipedia links (./), and absolute paths (/wiki/)
      if (url.startsWith('http') || url.startsWith('//') || url.startsWith('./') || url.startsWith('/wiki/')) {
        addCitation(url, linkText, undefined, 'Further reading')
      }
    }
  }
  
  // 3. Extract from External links section
  const externalLinksMatch = html.match(/<h2[^>]*>.*?External\s+links.*?<\/h2>([\s\S]*?)(?:<h2|$)/i)
  if (externalLinksMatch) {
    const sectionHtml = externalLinksMatch[1]
    const linkMatches = sectionHtml.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)
    for (const linkMatch of linkMatches) {
      const url = linkMatch[1]
      const linkText = linkMatch[2]?.replace(/<[^>]+>/g, '').trim()
      // Include all URLs: http/https, relative Wikipedia links (./), and absolute paths (/wiki/)
      if (url.startsWith('http') || url.startsWith('//') || url.startsWith('./') || url.startsWith('/wiki/')) {
        addCitation(url, linkText, undefined, 'External links')
      }
    }
  }
  
  return citations
}

/**
 * Extract Wikipedia citations with title and context for prioritization
 * Now uses comprehensive extraction from all sections
 */
export function extractWikipediaCitationsWithContext(
  html: string | undefined,
  sourceUrl: string,
  limit = 10000 // Extract ALL citations (very high limit)
): WikipediaCitation[] {
  // Use comprehensive extraction that gets ALL external URLs
  const allCitations = extractAllExternalUrls(html, sourceUrl)
  
  // Return up to limit
  return allCitations.slice(0, limit)
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
