/**
 * Content quality pipeline for discovery
 * Handles extraction, summarization, and boilerplate removal
 */

export interface ContentExtraction {
  title: string
  text: string
  summary: string
  keyPoints: string[]
  readingTime: number
  wordCount: number
  entities: string[]
  meta: {
    author?: string
    publishDate?: string
    domain: string
    url: string
  }
}

export interface SummarizationResult {
  summary: string
  keyPoints: string[]
  entities: string[]
  readingTime: number
}

/**
 * Content extractor with boilerplate removal
 */
export class ContentExtractor {
  /**
   * Extract and clean content from HTML
   */
  static async extractFromHtml(html: string, url: string): Promise<ContentExtraction> {
    try {
      // Remove boilerplate elements
      const cleanedHtml = this.removeBoilerplate(html)
      
      // Extract main content
      const title = this.extractTitle(cleanedHtml)
      const text = this.extractText(cleanedHtml)
      const meta = this.extractMeta(cleanedHtml, url)
      
      // Generate summary and key points
      const summarization = await this.summarizeContent(text, title, meta.domain)
      
      return {
        title,
        text,
        summary: summarization.summary,
        keyPoints: summarization.keyPoints,
        readingTime: summarization.readingTime,
        wordCount: text.split(/\s+/).length,
        entities: summarization.entities,
        meta
      }
    } catch (error) {
      console.error('[ContentExtractor] Error extracting content:', error)
      throw error
    }
  }
  
  /**
   * Remove boilerplate elements from HTML
   */
  private static removeBoilerplate(html: string): string {
    // Remove script, style, and other non-content elements
    let cleaned = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
      .replace(/<form[^>]*>[\s\S]*?<\/form>/gi, '')
      .replace(/<div[^>]*class=["'][^"']*(?:menu|breadcrumb|cookie|legal|newsletter|share|modal|overlay|ad)[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, '')
      .replace(/<div[^>]*role=["']navigation["'][^>]*>[\s\S]*?<\/div>/gi, '')
    
    // Remove elements with common boilerplate classes
    const boilerplateClasses = [
      'menu', 'navigation', 'nav', 'breadcrumb', 'sidebar', 'footer',
      'cookie', 'legal', 'newsletter', 'share', 'social', 'modal',
      'overlay', 'ad', 'advertisement', 'banner', 'popup'
    ]
    
    for (const className of boilerplateClasses) {
      const regex = new RegExp(`<[^>]*class=["'][^"']*${className}[^"']*["'][^>]*>[\s\S]*?<\/[^>]+>`, 'gi')
      cleaned = cleaned.replace(regex, '')
    }
    
    return cleaned
  }
  
  /**
   * Extract title from HTML
   */
  private static extractTitle(html: string): string {
    // Try multiple title sources
    const titleRegex = /<title[^>]*>([^<]+)<\/title>/i
    const h1Regex = /<h1[^>]*>([^<]+)<\/h1>/i
    const ogTitleRegex = /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i
    
    const titleMatch = html.match(titleRegex)
    const h1Match = html.match(h1Regex)
    const ogMatch = html.match(ogTitleRegex)
    
    const title = titleMatch?.[1] || h1Match?.[1] || ogMatch?.[1] || 'Untitled'
    
    // Clean up title
    return title
      .replace(/\s+/g, ' ')
      .replace(/[|–-].*$/, '') // Remove site name suffixes
      .trim()
  }
  
  /**
   * Extract main text content
   */
  private static extractText(html: string): string {
    // Extract paragraphs and headings
    const contentRegex = /<(?:p|h[1-6]|div|article|section)[^>]*>([^<]+)<\/(?:p|h[1-6]|div|article|section)>/gi
    const matches = html.match(contentRegex) || []
    
    // Join and clean text
    let text = matches
      .map(match => match.replace(/<[^>]+>/g, '').trim())
      .filter(block => block.length > 50) // Filter out short blocks
      .join('\n\n')
    
    // Clean up text
    text = text
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n\n')
      .trim()
    
    return text
  }
  
  /**
   * Extract metadata
   */
  private static extractMeta(html: string, url: string): ContentExtraction['meta'] {
    const domain = new URL(url).hostname
    const authorRegex = /<meta[^>]*name=["']author["'][^>]*content=["']([^"']+)["']/i
    const dateRegex = /<meta[^>]*property=["']article:published_time["'][^>]*content=["']([^"']+)["']/i
    
    const authorMatch = html.match(authorRegex)
    const dateMatch = html.match(dateRegex)
    
    return {
      author: authorMatch?.[1],
      publishDate: dateMatch?.[1],
      domain,
      url
    }
  }
  
  /**
   * Summarize content using AI
   */
  private static async summarizeContent(
    text: string,
    title: string,
    domain: string
  ): Promise<SummarizationResult> {
    try {
      // Truncate text to first 1500 words for summarization
      const words = text.split(/\s+/)
      const truncatedText = words.slice(0, 1500).join(' ')
      
      // Get base URL for API calls (works in both server and client contexts)
      const baseUrl = process.env.NEXTAUTH_URL || 
                     process.env.NEXT_PUBLIC_APP_URL || 
                     (typeof window !== 'undefined' ? window.location.origin : 'https://carrot-app.onrender.com')
      
      // Call AI summarization API - use summarize-content endpoint
      const response = await fetch(`${baseUrl}/api/ai/summarize-content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: truncatedText,
          title,
          url: `https://${domain}`, // Convert domain to URL format expected by API
          temperature: 0.2
        })
      })
      
      if (!response.ok) {
        throw new Error(`Summarization failed: ${response.status}`)
      }
      
      const result = await response.json()
      
      // Map the API response to our expected format
      // The summarize-content API returns: summary, keyFacts, notableQuotes, etc.
      return {
        summary: result.summary || this.generateFallbackSummary(text),
        keyPoints: result.keyFacts || result.keyPoints || this.generateFallbackKeyPoints(text),
        entities: result.entities || [],
        readingTime: Math.max(1, Math.floor(text.split(/\s+/).length / 200))
      }
    } catch (error) {
      console.error('[ContentExtractor] Summarization failed:', error)
      
      // Fallback to simple extraction
      return {
        summary: this.generateFallbackSummary(text),
        keyPoints: this.generateFallbackKeyPoints(text),
        entities: [],
        readingTime: Math.max(1, Math.floor(text.split(/\s+/).length / 200))
      }
    }
  }
  
  /**
   * Generate fallback summary
   */
  private static generateFallbackSummary(text: string): string {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20)
    const firstTwo = sentences.slice(0, 2).join('. ').trim()
    return firstTwo.length > 0 ? firstTwo + '.' : text.substring(0, 200) + '...'
  }
  
  /**
   * Generate fallback key points
   */
  private static generateFallbackKeyPoints(text: string): string[] {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 30)
    return sentences.slice(0, 5).map(s => s.trim()).filter(s => s.length > 0)
  }
}

/**
 * Content quality validator
 */
export class ContentQualityValidator {
  /**
   * Validate content quality
   */
  static validate(extraction: ContentExtraction): {
    isValid: boolean
    score: number
    issues: string[]
  } {
    const issues: string[] = []
    let score = 100
    
    // Check title quality
    if (extraction.title.length < 10) {
      issues.push('Title too short')
      score -= 20
    }
    
    if (extraction.title.length > 100) {
      issues.push('Title too long')
      score -= 10
    }
    
    // Check summary quality
    if (extraction.summary.length < 120) {
      issues.push('Summary too short')
      score -= 15
    }
    
    if (extraction.summary.length > 300) {
      issues.push('Summary too long')
      score -= 10
    }
    
    // Check key points
    if (extraction.keyPoints.length < 3) {
      issues.push('Too few key points')
      score -= 20
    }
    
    if (extraction.keyPoints.length > 7) {
      issues.push('Too many key points')
      score -= 5
    }
    
    // Check text quality
    if (extraction.wordCount < 200) {
      issues.push('Content too short')
      score -= 25
    }
    
    // Check for boilerplate
    const boilerplateWords = ['click here', 'read more', 'learn more', 'subscribe', 'newsletter']
    const hasBoilerplate = boilerplateWords.some(word => 
      extraction.text.toLowerCase().includes(word)
    )
    
    if (hasBoilerplate) {
      issues.push('Contains boilerplate text')
      score -= 15
    }
    
    return {
      isValid: score >= 70,
      score: Math.max(0, score),
      issues
    }
  }
}
