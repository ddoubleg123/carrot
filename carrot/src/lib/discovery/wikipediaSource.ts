/**
 * Wikipedia API integration with citation extraction
 */

export interface WikipediaPage {
  title: string
  url: string
  content: string
  summary: string
  citations: WikipediaCitation[]
  infobox?: Record<string, string>
  categories: string[]
}

export interface WikipediaCitation {
  index: number
  text: string
  url?: string
  title?: string
  author?: string
  date?: string
  publisher?: string
}

export class WikipediaSource {
  private static readonly BASE_URL = 'https://en.wikipedia.org/api/rest_v1'
  private static readonly RATE_LIMIT_DELAY = 1000 // 1 second between requests

  /**
   * Search Wikipedia for pages matching a query
   */
  static async search(query: string, limit: number = 10): Promise<string[]> {
    try {
      console.log(`[Wikipedia] Searching for: "${query}"`)
      
      const searchUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=${limit}&format=json`
      
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)
      
      const response = await fetch(searchUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'CarrotApp/1.0 (Educational research platform)'
        }
      })
      
      clearTimeout(timeout)
      
      if (!response.ok) {
        throw new Error(`Wikipedia search failed: ${response.status}`)
      }
      
      const data = await response.json()
      
      // OpenSearch returns: [query, [titles], [descriptions], [urls]]
      const titles = data[1] || []
      
      console.log(`[Wikipedia] Found ${titles.length} pages for "${query}"`)
      return titles
      
    } catch (error: any) {
      console.error(`[Wikipedia] Search error for "${query}":`, error)
      return []
    }
  }

  /**
   * Get a Wikipedia page with full content and citations
   */
  static async getPage(title: string): Promise<WikipediaPage | null> {
    try {
      console.log(`[Wikipedia] Fetching page: "${title}"`)
      
      // Get page HTML for citation extraction
      const htmlUrl = `${this.BASE_URL}/page/html/${encodeURIComponent(title)}`
      
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)
      
      const response = await fetch(htmlUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'CarrotApp/1.0 (Educational research platform)'
        }
      })
      
      clearTimeout(timeout)
      
      if (!response.ok) {
        throw new Error(`Wikipedia fetch failed: ${response.status}`)
      }
      
      const html = await response.text()
      
      // Extract citations from HTML
      const citations = this.extractCitations(html)
      
      // Get summary via REST API
      const summaryUrl = `${this.BASE_URL}/page/summary/${encodeURIComponent(title)}`
      const summaryResponse = await fetch(summaryUrl, {
        headers: {
          'User-Agent': 'CarrotApp/1.0 (Educational research platform)'
        }
      })
      
      let summary = ''
      if (summaryResponse.ok) {
        const summaryData = await summaryResponse.json()
        summary = summaryData.extract || ''
      }
      
      // Extract categories
      const categories = this.extractCategories(html)
      
      const page: WikipediaPage = {
        title,
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
        content: this.extractMainContent(html),
        summary,
        citations,
        categories
      }
      
      console.log(`[Wikipedia] ✅ Fetched "${title}" with ${citations.length} citations`)
      
      return page
      
    } catch (error: any) {
      console.error(`[Wikipedia] Error fetching "${title}":`, error)
      return null
    }
  }

  /**
   * Extract citations from Wikipedia HTML
   */
  private static extractCitations(html: string): WikipediaCitation[] {
    const citations: WikipediaCitation[] = []
    
    try {
      // Match reference list items: <li id="cite_note-1"><span class="reference-text">...</span></li>
      const referenceMatches = html.matchAll(/<li[^>]*id=["']cite_note-(\d+)["'][^>]*>([\s\S]*?)<\/li>/gi)
      
      for (const match of referenceMatches) {
        const index = parseInt(match[1])
        const refHtml = match[2]
        
        // Extract the reference text
        const textMatch = refHtml.match(/<span[^>]*class=["']reference-text["'][^>]*>([\s\S]*?)<\/span>/i)
        if (!textMatch) continue
        
        const refText = textMatch[1]
        
        // Extract URL from <a class="external"> links
        const urlMatch = refText.match(/<a[^>]*class=["'][^"']*external[^"']*["'][^>]*href=["']([^"']+)["']/i)
        const url = urlMatch ? urlMatch[1] : undefined
        
        // Extract title from cite_web or similar
        const titleMatch = refText.match(/title=["']([^"']+)["']/i) || 
                          refText.match(/<cite[^>]*>([^<]+)<\/cite>/i)
        const title = titleMatch ? titleMatch[1] : undefined
        
        // Extract author
        const authorMatch = refText.match(/author=["']([^"']+)["']/i) ||
                           refText.match(/\b([A-Z][a-z]+,\s+[A-Z][a-z]+)\b/)
        const author = authorMatch ? authorMatch[1] : undefined
        
        // Extract date
        const dateMatch = refText.match(/date=["']([^"']+)["']/i) ||
                         refText.match(/\b(\d{4}-\d{2}-\d{2}|\d{1,2}\s+\w+\s+\d{4})\b/)
        const date = dateMatch ? dateMatch[1] : undefined
        
        // Clean text (remove HTML tags)
        const cleanText = refText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
        
        if (url || cleanText.length > 10) {
          citations.push({
            index,
            text: cleanText,
            url,
            title,
            author,
            date
          })
        }
      }
      
      // Also look for external links section
      const externalLinksMatch = html.match(/<h2[^>]*>.*?External links.*?<\/h2>([\s\S]*?)(?:<h2|$)/i)
      if (externalLinksMatch) {
        const externalLinksHtml = externalLinksMatch[1]
        const linkMatches = externalLinksHtml.matchAll(/<a[^>]*href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi)
        
        for (const linkMatch of linkMatches) {
          const url = linkMatch[1]
          const title = linkMatch[2]
          
          // Skip Wikipedia internal links
          if (url.includes('wikipedia.org') || url.startsWith('#') || url.startsWith('/')) {
            continue
          }
          
          citations.push({
            index: citations.length + 1000, // High index to distinguish from footnotes
            text: title,
            url,
            title
          })
        }
      }
      
    } catch (error) {
      console.error('[Wikipedia] Error extracting citations:', error)
    }
    
    return citations
  }

  /**
   * Extract main content text from Wikipedia HTML
   */
  private static extractMainContent(html: string): string {
    try {
      // Remove script, style, navigation elements
      let content = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
        .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
        .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      
      // Extract paragraphs
      const paragraphs = content.match(/<p[^>]*>[\s\S]*?<\/p>/gi) || []
      
      // Clean and join
      const text = paragraphs
        .map(p => p.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
        .filter(p => p.length > 50)
        .join('\n\n')
      
      return text.substring(0, 10000) // Limit to 10k chars
      
    } catch (error) {
      console.error('[Wikipedia] Error extracting content:', error)
      return ''
    }
  }

  /**
   * Extract categories from Wikipedia HTML
   */
  private static extractCategories(html: string): string[] {
    try {
      const categoryMatches = html.matchAll(/<a[^>]*title=["']Category:([^"']+)["'][^>]*>/gi)
      const categories = Array.from(categoryMatches).map(m => m[1])
      return categories.slice(0, 20) // Limit to 20 categories
    } catch (error) {
      return []
    }
  }

  /**
   * Get multiple pages with rate limiting
   */
  static async getPages(titles: string[]): Promise<WikipediaPage[]> {
    const pages: WikipediaPage[] = []
    
    for (const title of titles) {
      const page = await this.getPage(title)
      if (page) {
        pages.push(page)
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, this.RATE_LIMIT_DELAY))
    }
    
    return pages
  }
}


  /**
   * Extract external references/links from a Wikipedia page (for discovery frontier)
   * Returns URLs from citations and external links section
   */
  static async getExternalReferences(title: string): Promise<string[]> {
    try {
      const page = await this.getPage(title)
      if (!page) return []
      
      const urls: string[] = []
      const seenUrls = new Set<string>()
      
      // Extract URLs from citations
      for (const citation of page.citations) {
        if (citation.url && !citation.url.includes('wikipedia.org')) {
          // Clean URL (remove fragments, normalize)
          try {
            const url = new URL(citation.url)
            url.hash = ''
            const cleanUrl = url.toString()
            
            if (!seenUrls.has(cleanUrl)) {
              seenUrls.add(cleanUrl)
              urls.push(cleanUrl)
            }
          } catch (e) {
            // Invalid URL, skip
            continue
          }
        }
      }
      
      console.log([Wikipedia] Found  external references from "")
      return urls
      
    } catch (error: any) {
      console.error([Wikipedia] Error getting external references for "":, error)
      return []
    }
  }

  /**
   * Get category pages related to a topic (for discovery)
   */
  static async getCategoryPages(categoryName: string, limit: number = 10): Promise<string[]> {
    try {
      const categoryUrl = https://en.wikipedia.org/w/api.php?action=query&list=categorymembers&cmtitle=Category:&cmlimit=&format=json
      
      const response = await fetch(categoryUrl, {
        headers: {
          'User-Agent': 'CarrotApp/1.0 (Educational research platform)'
        },
        signal: AbortSignal.timeout(5000)
      })
      
      if (!response.ok) {
        throw new Error(Category API failed: )
      }
      
      const data = await response.json()
      const members = data.query?.categorymembers || []
      
      const titles = members.map((m: any) => m.title).filter((title: string) => !title.startsWith('Category:'))
      
      console.log([Wikipedia] Found  pages in category "")
      return titles
      
    } catch (error: any) {
      console.error([Wikipedia] Error getting category pages for "":, error)
      return []
    }
  }

