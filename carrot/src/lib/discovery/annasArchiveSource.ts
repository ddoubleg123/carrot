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

    // Fetch search results
    const response = await fetch(searchUrl.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CarrotBot/1.0; +https://carrot-app.onrender.com)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
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
 * This is a basic implementation. For production, consider:
 * - Using a proper HTML parser (cheerio, jsdom)
 * - Handling pagination
 * - Extracting more metadata
 */
function parseSearchResults(html: string, limit: number): AnnasArchiveResult[] {
  const results: AnnasArchiveResult[] = []

  try {
    // Look for result items in the HTML
    // Anna's Archive typically structures results in a specific format
    // This is a simplified parser - adjust based on actual structure
    
    // Pattern: Look for links and metadata in search results
    // This regex approach is basic - consider using a proper HTML parser
    const resultPattern = /<div[^>]*class="[^"]*result[^"]*"[^>]*>([\s\S]*?)<\/div>/gi
    let match
    let count = 0

    while ((match = resultPattern.exec(html)) !== null && count < limit) {
      const resultHtml = match[1]
      
      // Extract title (usually in a link or heading)
      const titleMatch = resultHtml.match(/<a[^>]*>([^<]+)<\/a>/i) || 
                        resultHtml.match(/<h[23][^>]*>([^<]+)<\/h[23]>/i)
      
      // Extract URL
      const urlMatch = resultHtml.match(/href="([^"]+)"/i)
      
      // Extract author (often in metadata)
      const authorMatch = resultHtml.match(/author[^>]*>([^<]+)</i) ||
                         resultHtml.match(/by\s+([^<,]+)/i)
      
      // Extract year
      const yearMatch = resultHtml.match(/(\d{4})/g)
      
      // Extract file type
      const fileTypeMatch = resultHtml.match(/(pdf|epub|djvu)/i)

      if (titleMatch && urlMatch) {
        const title = titleMatch[1].trim()
        let url = urlMatch[1]
        
        // Make URL absolute if relative
        if (url.startsWith('/')) {
          url = `https://annas-archive.org${url}`
        }

        results.push({
          title,
          author: authorMatch ? authorMatch[1].trim() : undefined,
          year: yearMatch ? parseInt(yearMatch[0]) : undefined,
          fileType: fileTypeMatch ? fileTypeMatch[1].toLowerCase() as 'pdf' | 'epub' : undefined,
          url,
          source: extractSource(url)
        })

        count++
      }
    }

  } catch (error: any) {
    console.error(`[AnnasArchive] Parse error:`, error.message)
  }

  return results
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
 * This would fetch the detail page and extract preview text
 */
export async function getAnnasArchivePreview(result: AnnasArchiveResult): Promise<string | null> {
  try {
    const response = await fetch(result.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CarrotBot/1.0)',
        'Accept': 'text/html'
      },
      signal: AbortSignal.timeout(10000)
    })

    if (!response.ok) {
      return null
    }

    const html = await response.text()
    
    // Extract preview/description from detail page
    // This is simplified - adjust based on actual structure
    const previewMatch = html.match(/<div[^>]*class="[^"]*description[^"]*"[^>]*>([\s\S]{100,500})<\/div>/i) ||
                        html.match(/<p[^>]*>([\s\S]{100,500})<\/p>/i)

    if (previewMatch) {
      // Clean HTML tags
      return previewMatch[1]
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 500)
    }

    return null
  } catch (error) {
    console.warn(`[AnnasArchive] Failed to get preview for ${result.url}:`, error)
    return null
  }
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

