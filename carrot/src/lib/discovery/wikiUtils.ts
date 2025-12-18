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
 * Extract internal Wikipedia links from a Wikipedia page
 * Returns array of Wikipedia page URLs (not external URLs)
 */
export function extractInternalWikipediaLinks(
  html: string | undefined,
  sourceUrl: string,
  limit = 50
): string[] {
  if (!html) return []
  
  const wikipediaLinks: string[] = []
  const seenUrls = new Set<string>()
  
  try {
    // Extract all links from the page
    const anchorRegex = /<a[^>]+href=['"]([^'"#]+)['"][^>]*>/gi
    let match: RegExpExecArray | null
    
    while ((match = anchorRegex.exec(html)) && wikipediaLinks.length < limit) {
      const href = match[1]
      
      // Skip non-Wikipedia links
      if (!href.includes('wikipedia.org') && !href.startsWith('/wiki/') && !href.startsWith('./')) {
        continue
      }
      
      // Convert relative links to absolute
      let normalizedUrl: string
      if (href.startsWith('/wiki/')) {
        // Absolute path Wikipedia link
        const pageName = href.replace('/wiki/', '')
        normalizedUrl = `https://en.wikipedia.org/wiki/${pageName}`
      } else if (href.startsWith('./')) {
        // Relative Wikipedia link
        const pageName = href.replace('./', '').replace(/^\/wiki\//, '')
        normalizedUrl = `https://en.wikipedia.org/wiki/${pageName}`
      } else if (href.includes('wikipedia.org/wiki/')) {
        // Already absolute Wikipedia URL
        normalizedUrl = normaliseUrl(href, sourceUrl) || href
      } else {
        continue
      }
      
      // Canonicalize and deduplicate
      const canonical = canonicalizeUrlFast(normalizedUrl)
      if (!canonical) continue
      
      // Skip if already seen
      if (seenUrls.has(canonical)) continue
      
      // Only include en.wikipedia.org/wiki/ links (not other Wikipedia domains)
      if (!canonical.includes('en.wikipedia.org/wiki/')) continue
      
      // Skip special pages (User:, Talk:, File:, etc.)
      const pathMatch = canonical.match(/\/wiki\/([^\/]+)/)
      if (pathMatch) {
        const pageName = pathMatch[1]
        const specialPrefixes = ['User:', 'Talk:', 'File:', 'Image:', 'Category:', 'Template:', 'Help:', 'Special:', 'Portal:', 'Wikipedia:', 'Media:']
        if (specialPrefixes.some(prefix => pageName.startsWith(prefix))) {
          continue
        }
      }
      
      seenUrls.add(canonical)
      wikipediaLinks.push(canonical)
    }
  } catch (error) {
    console.error('[WikiUtils] Error extracting internal Wikipedia links:', error)
  }
  
  return wikipediaLinks
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
    // Skip relative Wikipedia links (./, /wiki/) - these are internal links
    if (url.startsWith('./') || url.startsWith('/wiki/') || url.startsWith('../')) {
      return // Skip Wikipedia internal links
    }
    
    // Only process http/https URLs
    if (!url.startsWith('http') && !url.startsWith('//')) {
      return
    }
    
    // Normalize URL
    const normalised = normaliseUrl(url, sourceUrl)
    if (!normalised) return
    
    // Check if it's a Wikipedia URL
    if (isWikipediaUrl(normalised)) {
      return // Skip Wikipedia URLs
    }
    
    const canonical = canonicalizeUrlFast(normalised)
    if (!canonical) return
    
    // Double-check: skip if canonical URL is a Wikipedia URL
    if (isWikipediaUrl(canonical)) {
      return
    }
    
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
  const referencesMatch = html.match(/<ol[^>]*class=["'][^"']*references[^"']*["'][^>]*>([\s\S]*?)<\/ol>/i)
  if (referencesMatch) {
    const refsHtml = referencesMatch[1]
    const refMatches = refsHtml.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)
    
    for (const refMatch of refMatches) {
      const ref = refMatch[1]
      
      // Extract all URLs from this reference (only external URLs)
      const urlMatches = ref.matchAll(/href=["']([^"']+)["']/gi)
      for (const urlMatch of urlMatches) {
        const url = urlMatch[1]
        // Only include http/https URLs (skip relative Wikipedia links)
        if (!url.startsWith('http') && !url.startsWith('//')) {
          continue
        }
        
        // Extract title/context
        const citeMatch = ref.match(/<cite[^>]*>([^<]+)<\/cite>/i)
        const textMatch = ref.match(/<span[^>]*class=["'][^"']*reference-text[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)
        const linkTextMatch = ref.match(/<a[^>]*href=["'][^"']*["'][^>]*>([^<]+)<\/a>/i)
        
        const title = citeMatch?.[1]?.replace(/<[^>]+>/g, '').trim() || 
                     linkTextMatch?.[1]?.replace(/<[^>]+>/g, '').trim() || 
                     undefined
        const context = textMatch?.[1]?.replace(/<[^>]+>/g, '').trim() || undefined
        
        addCitation(url, title, context, 'References')
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
      // Only include http/https URLs (skip relative Wikipedia links)
      if (url.startsWith('http') || url.startsWith('//')) {
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
      // Only include http/https URLs (skip relative Wikipedia links)
      if (url.startsWith('http') || url.startsWith('//')) {
        addCitation(url, linkText, undefined, 'External links')
      }
    }
  }
  
  return citations
}

/**
 * Extract Wikipedia citations with context (title, text, context)
 * Extracts from References, Further reading, and External links sections
 * Also parses citation templates to extract external URLs
 */
export function extractWikipediaCitationsWithContext(
  html: string | undefined,
  sourceUrl: string,
  limit = 10000
): WikipediaCitation[] {
  if (!html) return []
  
  const citations: WikipediaCitation[] = []
  const seenUrls = new Set<string>()
  
  // Helper function to check if URL is Wikipedia internal
  // Includes ALL Wikipedia/Wikimedia domains (wiktionary, wikinews, wikiquote, etc.)
  function isWikipediaUrl(url: string): boolean {
    if (url.startsWith('./') || url.startsWith('/wiki/') || url.startsWith('../')) {
      return true
    }
    if (url.includes('wikipedia.org/wiki/') || url.includes('wikipedia.org/w/')) {
      return true
    }
    try {
      const urlObj = new URL(url, sourceUrl)
      const hostname = urlObj.hostname.toLowerCase().replace(/^www\./, '')
      // Filter out ALL Wikipedia/Wikimedia domains
      return hostname.includes('wikipedia.org') || 
             hostname.includes('wikimedia.org') || 
             hostname.includes('wikidata.org') ||
             hostname.includes('wiktionary.org') ||
             hostname.includes('wikinews.org') ||
             hostname.includes('wikiquote.org') ||
             hostname.includes('wikisource.org') ||
             hostname.includes('wikibooks.org') ||
             hostname.includes('wikiversity.org') ||
             hostname.includes('wikivoyage.org') ||
             hostname.includes('wikimediafoundation.org') ||
             hostname.includes('mediawiki.org') ||
             hostname.includes('toolforge.org') // Wikipedia toolforge tools
    } catch {
      return false
    }
  }
  
  // Helper function to add citation (with filtering)
  function addCitation(url: string, title?: string, context?: string, section?: string) {
    // Skip Wikipedia internal links
    if (isWikipediaUrl(url)) {
      return
    }
    
    // Normalize URL
    const normalized = normaliseUrl(url, sourceUrl)
    if (!normalized) return
    
    // Double-check: skip if normalized URL is a Wikipedia URL
    if (isWikipediaUrl(normalized)) {
      return
    }
    
    const canonical = canonicalizeUrlFast(normalized)
    if (!canonical) return
    
    // Triple-check: skip if canonical URL is a Wikipedia URL
    if (isWikipediaUrl(canonical)) {
      return
    }
    
    if (!seenUrls.has(canonical)) {
      seenUrls.add(canonical)
      // Include section name in context for tracking
      const contextWithSection = section 
        ? `[${section}] ${context ? context.substring(0, 450) : title || ''}`.trim()
        : (context ? context.substring(0, 500) : undefined)
      citations.push({
        url: canonical,
        title,
        context: contextWithSection,
        text: context || title
      })
    }
  }
  
  // 1. Extract from References section (entire area, not just <ol>)
  // Find the References h2 and everything until the next h2 or end
  const referencesAreaMatch = html.match(/<h2[^>]*>.*?References.*?<\/h2>([\s\S]*?)(?:<h2[^>]*>|$)/i)
  if (referencesAreaMatch) {
    const refsAreaHtml = referencesAreaMatch[1]
    
    // Extract ALL external URLs from the entire References area
    // This includes: References <ol>, Works cited, and any other reference content
    
    // Method 1: Extract from References <ol> (inline citations)
    const refsOlMatch = refsAreaHtml.match(/<ol[^>]*class=["'][^"']*references[^"']*["'][^>]*>([\s\S]*?)<\/ol>/i)
    if (refsOlMatch) {
      const refsOlHtml = refsOlMatch[1]
      const refMatches = refsOlHtml.matchAll(/<li[^>]*id=["']cite_note-(\d+)["'][^>]*>([\s\S]*?)<\/li>/gi)
      
      for (const refMatch of refMatches) {
        if (citations.length >= limit) break
        
        const index = parseInt(refMatch[1])
        const refHtml = refMatch[2]
        
        // Extract reference text
        const textMatch = refHtml.match(/<span[^>]*class=["'][^"']*reference-text[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)
        if (!textMatch) continue
        
        const refText = textMatch[1]
        
        // Extract ALL URLs from this reference (not just the first one)
        const urlPatterns = [
          // Standard <a href>
          /<a[^>]+href=["'](https?:\/\/[^"']+)["'][^>]*>/gi,
          // Plain text URLs
          /(https?:\/\/[^\s"'<]+)/gi,
          // Citation template attributes
          /(?:url|website|access-url|archive-url|archiveurl)=["']([^"']+)["']/gi
        ]
        
        const foundUrls: string[] = []
        for (const pattern of urlPatterns) {
          const matches = Array.from(refText.matchAll(pattern))
          for (const match of matches) {
            const url = match[1] || match[0]
            if (url && !foundUrls.includes(url)) {
              foundUrls.push(url)
            }
          }
        }
        
        // Extract title
        const titleMatch = refText.match(/title=["']([^"']+)["']/i) || 
                          refText.match(/<cite[^>]*>([^<]+)<\/cite>/i)
        const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : undefined
        
        // Clean context text
        const context = refText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
        
        // Add each URL found
        for (const url of foundUrls) {
          if (citations.length >= limit) break
          addCitation(url, title, context, 'References')
        }
      }
    }
    
    // Method 2: Extract from Works cited section (bibliography)
    const worksCitedMatch = refsAreaHtml.match(/<h2[^>]*>.*?Works\s+cited.*?<\/h2>([\s\S]*?)(?:<h2|$)/i) ||
                           refsAreaHtml.match(/<h3[^>]*>.*?Works\s+cited.*?<\/h3>([\s\S]*?)(?:<h[23]|$)/i) ||
                           // Also check for <ul> or <ol> with class containing "references" or "bibliography"
                           refsAreaHtml.match(/<(?:ul|ol)[^>]*class=["'][^"']*(?:references|bibliography)[^"']*["'][^>]*>([\s\S]*?)<\/(?:ul|ol)>/i)
    
    if (worksCitedMatch) {
      const worksHtml = worksCitedMatch[1]
      
      // Extract ALL URLs from Works cited
      const urlPatterns = [
        // Standard <a href>
        /<a[^>]+href=["'](https?:\/\/[^"']+)["'][^>]*>/gi,
        // "Archived from the original" links
        /Archived\s+from\s+the\s+original[^<]*<a[^>]+href=["']([^"']+)["'][^>]*>/gi,
        // Plain text URLs
        /(https?:\/\/[^\s"'<]+)/gi,
        // Citation template attributes
        /(?:url|website|access-url|archive-url|archiveurl)=["']([^"']+)["']/gi
      ]
      
      const foundUrls = new Set<string>()
      for (const pattern of urlPatterns) {
        const matches = Array.from(worksHtml.matchAll(pattern))
        for (const match of matches) {
          const url = match[1] || match[0]
          if (url) {
            foundUrls.add(url)
          }
        }
      }
      
      // Process each <li> item in Works cited to get context
      const liMatches = Array.from(worksHtml.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi))
      
      for (const liMatch of liMatches) {
        if (citations.length >= limit) break
        
        const liHtml = liMatch[1]
        
        // Extract URLs from this <li>
        const liUrlPatterns = [
          /<a[^>]+href=["'](https?:\/\/[^"']+)["'][^>]*>/gi,
          /(https?:\/\/[^\s"'<]+)/gi
        ]
        
        const liUrls: string[] = []
        for (const pattern of liUrlPatterns) {
          const matches = Array.from(liHtml.matchAll(pattern))
          for (const match of matches) {
            const url = match[1] || match[0]
            if (url && foundUrls.has(url) && !liUrls.includes(url)) {
              liUrls.push(url)
            }
          }
        }
        
        // Extract title/context
        const titleMatch = liHtml.match(/<cite[^>]*>([^<]+)<\/cite>/i) ||
                         liHtml.match(/<strong[^>]*>([^<]+)<\/strong>/i)
        const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : undefined
        const context = liHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
        
        // Add each URL
        for (const url of liUrls) {
          if (citations.length >= limit) break
          addCitation(url, title, context, 'Works cited')
        }
      }
      
      // Also add any remaining URLs that weren't in <li> items
      for (const url of foundUrls) {
        if (citations.length >= limit) break
        // Check if we already added this URL
        const canonical = canonicalizeUrlFast(normaliseUrl(url, sourceUrl) || url)
        if (canonical && !citations.some(c => canonicalizeUrlFast(normaliseUrl(c.url, sourceUrl) || c.url) === canonical)) {
          addCitation(url, undefined, undefined, 'Works cited')
        }
      }
    } else {
      // If no Works cited section found, extract ALL URLs from the entire References area
      // This catches URLs that might be in other formats
      const allUrlPatterns = [
        /<a[^>]+href=["'](https?:\/\/[^"']+)["'][^>]*>/gi,
        /(https?:\/\/[^\s"'<]+)/gi
      ]
      
      const foundUrls = new Set<string>()
      for (const pattern of allUrlPatterns) {
        const matches = Array.from(refsAreaHtml.matchAll(pattern))
        for (const match of matches) {
          const url = match[1] || match[0]
          if (url) {
            foundUrls.add(url)
          }
        }
      }
      
      // Add URLs that aren't Wikipedia
      for (const url of foundUrls) {
        if (citations.length >= limit) break
        addCitation(url, undefined, undefined, 'References')
      }
    }
  }
  
  // 2. Extract from Further reading section
  const furtherReadingMatch = html.match(/<h2[^>]*>.*?Further\s+reading.*?<\/h2>([\s\S]*?)(?:<h2|$)/i)
  if (furtherReadingMatch) {
    const sectionHtml = furtherReadingMatch[1]
    const linkMatches = sectionHtml.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)
    
    for (const linkMatch of linkMatches) {
      if (citations.length >= limit) break
      
      const url = linkMatch[1]
      const linkText = linkMatch[2]?.replace(/<[^>]+>/g, '').trim()
      
      // Only include http/https URLs (skip relative Wikipedia links)
      if (url.startsWith('http') || url.startsWith('//')) {
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
      if (citations.length >= limit) break
      
      const url = linkMatch[1]
      const linkText = linkMatch[2]?.replace(/<[^>]+>/g, '').trim()
      
      // Only include http/https URLs (skip relative Wikipedia links)
      if (url.startsWith('http') || url.startsWith('//')) {
        addCitation(url, linkText, undefined, 'External links')
      }
    }
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
