/**
 * Anna's Archive source integration
 * Searches Anna's Archive for books, papers, and documents
 * 
 * Uses web scraping approach (no membership required)
 * Can be upgraded to official API if membership obtained
 */

export interface AnnasArchiveResult {
  title: string
  author?: string
  year?: number
  isbn?: string
  language?: string
  fileType?: string
  fileSize?: string
  md5?: string
  url: string
  source?: string // e.g., "libgen", "z-library", "internet-archive"
  preview?: string
}

export interface AnnasArchiveSearchOptions {
  query: string
  language?: string
  fileType?: 'pdf' | 'epub' | 'all'
  limit?: number
}

/**
 * Search Anna's Archive
 * 
 * Note: This uses web scraping. For production, consider:
 * 1. Official API (requires membership)
 * 2. Rate limiting
 * 3. Error handling for site changes
 */
export async function searchAnnasArchive(
  options: AnnasArchiveSearchOptions
): Promise<AnnasArchiveResult[]> {
  const { query, language = 'en', fileType = 'all', limit = 20 } = options

  try {
    // Rate limiting: Add delay between requests
    // Anna's Archive may rate limit, so be respectful
    await new Promise(resolve => setTimeout(resolve, 2000)) // 2 second delay
    
    // Build search URL
    const searchUrl = new URL('https://annas-archive.org/search')
    searchUrl.searchParams.set('q', query)
    if (language !== 'all') {
      searchUrl.searchParams.set('lang', language)
    }
    if (fileType !== 'all') {
      searchUrl.searchParams.set('ext', fileType)
    }

    console.log(`[AnnasArchive] Searching: ${searchUrl.toString()}`)

    // Fetch search results with proper headers
    const response = await fetch(searchUrl.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': 'https://annas-archive.org/'
      },
      signal: AbortSignal.timeout(15000) // 15s timeout
    })

    if (!response.ok) {
      throw new Error(`Anna's Archive search failed: ${response.status}`)
    }

    const html = await response.text()
    
    // Parse HTML to extract results
    // Note: This is a simplified parser - may need refinement based on actual HTML structure
    const results = parseSearchResults(html, limit)

    console.log(`[AnnasArchive] Found ${results.length} results for "${query}"`)
    return results

  } catch (error: any) {
    console.error(`[AnnasArchive] Search error:`, error.message)
    return []
  }
}

/**
 * Parse search results from HTML
 * 
 * Anna's Archive uses React/Next.js with data-content attributes
 * Structure: data-content attributes contain titles and authors
 */
function parseSearchResults(html: string, limit: number): AnnasArchiveResult[] {
  const results: AnnasArchiveResult[] = []

  try {
    // Anna's Archive uses data-content attributes for book information
    // Look for patterns like: data-content="Book Title" and data-content="Author Name"
    
    // Find all data-content attributes (these contain titles and authors)
    const dataContentPattern = /data-content="([^"]+)"/gi
    const allDataContents: Array<{ value: string; index: number }> = []
    let match
    
    while ((match = dataContentPattern.exec(html)) !== null) {
      allDataContents.push({
        value: decodeHtmlEntities(match[1]),
        index: match.index
      })
    }
    
    // Find links to book detail pages
    // Links typically look like: /md5/... or /book/...
    const linkPattern = /href="(\/(?:md5|book|file)\/[^"]+)"/gi
    const links: Array<{ url: string; index: number }> = []
    
    while ((match = linkPattern.exec(html)) !== null) {
      const url = match[1].startsWith('/') 
        ? `https://annas-archive.org${match[1]}`
        : match[1]
      links.push({
        url,
        index: match.index
      })
    }
    
    // Group data-content values that are near each other (likely title + author pairs)
    // Titles and authors are usually within 200-500 characters of each other
    for (let i = 0; i < allDataContents.length - 1 && results.length < limit; i++) {
      const current = allDataContents[i]
      const next = allDataContents[i + 1]
      
      // Check if these are near a link (within 1000 chars)
      const nearbyLink = links.find(link => 
        Math.abs(link.index - current.index) < 1000
      )
      
      if (!nearbyLink) continue
      
      // Heuristic: If two data-content values are close together and one is longer,
      // the longer one is likely the title, shorter one might be author
      const distance = next.index - current.index
      
      if (distance < 500 && distance > 50) {
        // Likely a title-author pair
        const title = current.value.length > next.value.length ? current.value : next.value
        const author = current.value.length > next.value.length ? next.value : current.value
        
        // Skip if it looks like UI text
        if (title.length < 10 || title.includes('✕') || title.includes('Donate') || title.includes('Search')) {
          continue
        }
        
        // Extract year from nearby text (but not from title itself)
        // Look for year patterns that are likely publication years (1900-2025)
        const nearbyText = html.substring(current.index - 300, current.index + 600)
        const yearMatches = nearbyText.matchAll(/\b(19[5-9]\d|20[0-2]\d)\b/g)
        let year: number | undefined
        for (const yearMatch of yearMatches) {
          const candidateYear = parseInt(yearMatch[0])
          // Skip if it's clearly part of the title (like "1948" in "Since 1948")
          const context = nearbyText.substring(Math.max(0, yearMatch.index - 20), yearMatch.index + 30)
          if (!context.match(/(since|from|until|before|after)\s+\d{4}/i)) {
            year = candidateYear
            break
          }
        }
        
        // Extract file type from URL or nearby text
        const fileTypeMatch = nearbyLink.url.match(/\.(pdf|epub|djvu)/i) ||
                             html.substring(current.index - 100, current.index + 100).match(/\b(pdf|epub|djvu)\b/i)
        const fileType = fileTypeMatch ? fileTypeMatch[1].toLowerCase() as 'pdf' | 'epub' : undefined
        
        // Check if we already have this title (dedupe)
        if (results.some(r => r.title === title && r.author === author)) {
          continue
        }
        
        results.push({
          title: title.trim(),
          author: author.trim().length > 2 ? author.trim() : undefined,
          year,
          fileType,
          url: nearbyLink.url,
          source: extractSource(nearbyLink.url)
        })
      }
    }
    
    // If we didn't find enough results with the pairing approach, try simpler extraction
    if (results.length < limit && links.length > 0) {
      // Extract titles from data-content that are near links
      for (const link of links.slice(0, limit * 2)) {
        if (results.length >= limit) break
        
        // Find data-content near this link
        const linkStart = Math.max(0, link.index - 500)
        const linkEnd = Math.min(html.length, link.index + 500)
        const nearbyHtml = html.substring(linkStart, linkEnd)
        
        // Look for title-like data-content (longer text, not UI elements)
        const titleMatches = nearbyHtml.matchAll(/data-content="([^"]{20,200})"/gi)
        for (const titleMatch of titleMatches) {
          const title = decodeHtmlEntities(titleMatch[1])
          
          // Skip UI text
          if (title.includes('✕') || title.includes('Donate') || title.includes('Search') || 
              title.includes('Hide') || title.includes('Include')) {
            continue
          }
          
          // Check if already added
          if (results.some(r => r.title === title && r.url === link.url)) {
            continue
          }
          
          // Look for author nearby
          const authorMatch = nearbyHtml.match(/data-content="([^"]{3,50})"/g)
          let author: string | undefined
          if (authorMatch && authorMatch.length > 1) {
            // Second data-content near title is often the author
            const potentialAuthor = decodeHtmlEntities(authorMatch[1])
            if (potentialAuthor.length < title.length && potentialAuthor.length > 2) {
              author = potentialAuthor
            }
          }
          
          results.push({
            title: title.trim(),
            author,
            url: link.url,
            source: extractSource(link.url)
          })
          
          if (results.length >= limit) break
        }
      }
    }

  } catch (error: any) {
    console.error(`[AnnasArchive] Parse error:`, error.message)
  }

  return results.slice(0, limit)
}

/**
 * Extract source from URL
 */
function extractSource(url: string): string | undefined {
  if (url.includes('libgen')) return 'libgen'
  if (url.includes('z-library')) return 'z-library'
  if (url.includes('archive.org')) return 'internet-archive'
  if (url.includes('sci-hub')) return 'sci-hub'
  return undefined
}

/**
 * Get preview/excerpt for a result
 * 
 * Fetches the detail page and extracts preview text
 * Skips membership messages and UI text
 */
export async function getAnnasArchivePreview(result: AnnasArchiveResult): Promise<string | null> {
  try {
    // Add delay to respect rate limits
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    const response = await fetch(result.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      signal: AbortSignal.timeout(10000)
    })

    if (!response.ok) {
      return null
    }

    const html = await response.text()
    
    // Skip membership messages
    const skipPatterns = [
      /You have.*left today/i,
      /Thanks for being a member/i,
      /You've run out of fast downloads/i,
      /You downloaded this file recently/i,
      /Links remain valid/i,
      /Donate/i,
      /Membership/i
    ]
    
    // Extract preview/description from detail page
    // Look for data-content attributes with longer text (descriptions)
    const dataContentPattern = /data-content="([^"]{100,800})"/gi
    const descriptions: string[] = []
    
    let match
    while ((match = dataContentPattern.exec(html)) !== null) {
      const text = decodeHtmlEntities(match[1])
      
      // Skip if it's a membership message or UI text
      if (skipPatterns.some(pattern => pattern.test(text))) {
        continue
      }
      
      // Skip if it's too short or looks like metadata
      if (text.length < 100 || text.match(/^(ISBN|Publisher|Language|Year|Pages?|File|Size)/i)) {
        continue
      }
      
      descriptions.push(text)
    }
    
    // Also try traditional HTML patterns
    if (descriptions.length === 0) {
      const htmlPatterns = [
        /<div[^>]*class="[^"]*description[^"]*"[^>]*>([\s\S]{100,800})<\/div>/i,
        /<p[^>]*class="[^"]*description[^"]*"[^>]*>([\s\S]{100,800})<\/p>/i,
        /<div[^>]*class="[^"]*summary[^"]*"[^>]*>([\s\S]{100,800})<\/div>/i,
        /<p[^>]*>([\s\S]{100,500})<\/p>/i
      ]
      
      for (const pattern of htmlPatterns) {
        const match = html.match(pattern)
        if (match) {
          const text = match[1]
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
          
          if (text.length >= 100 && !skipPatterns.some(p => p.test(text))) {
            descriptions.push(text)
            break
          }
        }
      }
    }

    if (descriptions.length > 0) {
      // Return the longest description (most likely to be the actual preview)
      const bestDescription = descriptions.sort((a, b) => b.length - a.length)[0]
      return bestDescription.substring(0, 500)
    }

    return null
  } catch (error) {
    console.warn(`[AnnasArchive] Failed to get preview for ${result.url}:`, error)
    return null
  }
}

/**
 * Decode HTML entities
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&apos;/g, "'")
}

/**
 * Convert Anna's Archive result to DiscoveredSource format
 */
export function annasArchiveToDiscoveredSource(
  result: AnnasArchiveResult,
  patchHandle: string,
  relevanceScore: number = 0.7
): any {
  return {
    type: 'book' as const,
    title: result.title,
    url: result.url,
    domain: 'annas-archive.org',
    source: 'annas-archive',
    metadata: {
      author: result.author,
      year: result.year,
      isbn: result.isbn,
      language: result.language,
      fileType: result.fileType,
      source: result.source
    },
    relevanceScore,
    qualityScore: 0.8, // Books/papers are generally high quality
    patchHandle
  }
}

