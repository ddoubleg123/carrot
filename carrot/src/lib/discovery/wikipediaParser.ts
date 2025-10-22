/**
 * Wikipedia Parser for Chicago Bulls Discovery
 * Fetches and parses Wikipedia content with proper caching and reference extraction
 */

import { GroupProfile } from './groupProfiles'

export interface WikipediaPage {
  title: string
  url: string
  content: string
  infobox: Record<string, any>
  sections: Array<{
    title: string
    content: string
  }>
  references: Array<{
    title: string
    url: string
    domain: string
    date?: string
    outlet?: string
  }>
  lastModified?: string
  etag?: string
}

export interface WikipediaResult {
  mainPage: WikipediaPage
  references: WikipediaPage['references']
  novelCount: number
  cached: boolean
}

export class WikipediaParser {
  private cache = new Map<string, { data: WikipediaResult; timestamp: number }>()
  private readonly CACHE_TTL = 120000 // 2 minutes

  async parseGroupPage(groupProfile: GroupProfile): Promise<WikipediaResult> {
    const cacheKey = `wikipedia:${groupProfile.slug}`
    const cached = this.cache.get(cacheKey)
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      console.log(`[WikipediaParser] Cache hit for ${groupProfile.slug}`)
      return { ...cached.data, cached: true }
    }

    try {
      console.log(`[WikipediaParser] Fetching Wikipedia page for ${groupProfile.name}`)
      
      // Construct Wikipedia URL
      const wikiUrl = `https://en.wikipedia.org/wiki/${groupProfile.name.replace(/\s+/g, '_')}`
      
      // Fetch with proper headers
      const response = await fetch(wikiUrl, {
        headers: {
          'User-Agent': 'CarrotBot/1.0 (https://carrot-app.onrender.com)',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      })

      if (!response.ok) {
        throw new Error(`Wikipedia fetch failed: ${response.status}`)
      }

      const html = await response.text()
      const etag = response.headers.get('etag')
      const lastModified = response.headers.get('last-modified')

      // Parse the HTML
      const parsed = this.parseWikipediaHTML(html, wikiUrl, groupProfile)
      
      const result: WikipediaResult = {
        mainPage: parsed,
        references: parsed.references,
        novelCount: parsed.references.length,
        cached: false
      }

      // Cache the result
      this.cache.set(cacheKey, { data: result, timestamp: Date.now() })
      
      console.log(`[WikipediaParser] ✅ Parsed ${groupProfile.name}:`, {
        sections: parsed.sections.length,
        references: parsed.references.length,
        etag,
        lastModified
      })

      return result

    } catch (error) {
      console.error(`[WikipediaParser] Error parsing ${groupProfile.name}:`, error)
      throw error
    }
  }

  private parseWikipediaHTML(html: string, url: string, groupProfile: GroupProfile): WikipediaPage {
    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    const title = titleMatch ? titleMatch[1].replace(' - Wikipedia', '') : groupProfile.name

    // Extract infobox
    const infoboxMatch = html.match(/<table[^>]*class="[^"]*infobox[^"]*"[^>]*>([\s\S]*?)<\/table>/i)
    const infobox = infoboxMatch ? this.parseInfobox(infoboxMatch[1]) : {}

    // Extract main content sections
    const sections = this.extractSections(html)

    // Extract references
    const references = this.extractReferences(html)

    // Clean main content
    const content = this.cleanContent(html)

    return {
      title,
      url,
      content,
      infobox,
      sections,
      references
    }
  }

  private parseInfobox(infoboxHtml: string): Record<string, any> {
    const infobox: Record<string, any> = {}
    
    // Extract key-value pairs from infobox
    const rows = infoboxHtml.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || []
    
    for (const row of rows) {
      const labelMatch = row.match(/<th[^>]*>([^<]+)<\/th>/i)
      const valueMatch = row.match(/<td[^>]*>([\s\S]*?)<\/td>/i)
      
      if (labelMatch && valueMatch) {
        const label = labelMatch[1].trim().toLowerCase()
        const value = valueMatch[1].replace(/<[^>]+>/g, '').trim()
        infobox[label] = value
      }
    }
    
    return infobox
  }

  private extractSections(html: string): Array<{ title: string; content: string }> {
    const sections: Array<{ title: string; content: string }> = []
    
    // Find all h2 sections (main content)
    const h2Matches = html.match(/<h2[^>]*>[\s\S]*?<\/h2>/gi) || []
    
    for (const h2 of h2Matches) {
      const titleMatch = h2.match(/<span[^>]*class="[^"]*mw-headline[^"]*"[^>]*>([^<]+)<\/span>/i)
      if (titleMatch) {
        const title = titleMatch[1].trim()
        
        // Skip navigation sections
        if (['Contents', 'Navigation menu', 'Tools', 'Personal tools'].includes(title)) {
          continue
        }
        
        // Extract content until next h2
        const content = this.extractSectionContent(html, h2)
        if (content.length > 100) { // Only include substantial sections
          sections.push({ title, content })
        }
      }
    }
    
    return sections
  }

  private extractSectionContent(html: string, h2Element: string): string {
    const h2Index = html.indexOf(h2Element)
    if (h2Index === -1) return ''
    
    // Find next h2 or end of content
    const nextH2Match = html.substring(h2Index + h2Element.length).match(/<h2[^>]*>/i)
    const endIndex = nextH2Match ? h2Index + h2Element.length + nextH2Match.index! : html.length
    
    const sectionHtml = html.substring(h2Index, endIndex)
    
    // Clean and extract text
    return this.cleanContent(sectionHtml)
  }

  private extractReferences(html: string): Array<{ title: string; url: string; domain: string; date?: string; outlet?: string }> {
    const references: Array<{ title: string; url: string; domain: string; date?: string; outlet?: string }> = []
    
    // Find references section
    const refsMatch = html.match(/<ol[^>]*class="[^"]*references[^"]*"[^>]*>([\s\S]*?)<\/ol>/i)
    if (!refsMatch) return references
    
    const refsHtml = refsMatch[1]
    
    // Extract individual references
    const refMatches = refsHtml.match(/<li[^>]*>[\s\S]*?<\/li>/gi) || []
    
    for (const ref of refMatches) {
      // Extract URL
      const urlMatch = ref.match(/href="([^"]+)"/i)
      if (!urlMatch) continue
      
      const url = urlMatch[1]
      
      // Skip internal Wikipedia links
      if (url.startsWith('/wiki/') || url.startsWith('#')) continue
      
      // Extract title and other metadata
      const titleMatch = ref.match(/<cite[^>]*>([^<]+)<\/cite>/i) || 
                        ref.match(/<span[^>]*class="[^"]*reference-text[^"]*"[^>]*>([^<]+)<\/span>/i)
      
      const title = titleMatch ? titleMatch[1].trim() : 'Untitled'
      
      // Extract domain
      let domain = 'unknown'
      try {
        domain = new URL(url).hostname.replace('www.', '')
      } catch {}
      
      // Extract date and outlet from title
      const dateMatch = title.match(/(\d{4})/)
      const date = dateMatch ? dateMatch[1] : undefined
      
      const outletMatch = title.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/)
      const outlet = outletMatch ? outletMatch[1] : undefined
      
      references.push({
        title,
        url,
        domain,
        date,
        outlet
      })
    }
    
    return references.slice(0, 100) // Limit to 100 references
  }

  private cleanContent(html: string): string {
    // Remove unwanted elements
    let cleaned = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
      .replace(/<div[^>]*class="[^"]*navbox[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
      .replace(/<div[^>]*class="[^"]*infobox[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
      .replace(/<div[^>]*class="[^"]*thumb[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
      .replace(/<div[^>]*class="[^"]*gallery[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
    
    // Convert to text and clean
    cleaned = cleaned
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    
    return cleaned
  }
}
