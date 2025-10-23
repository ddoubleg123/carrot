/**
 * Content Quality Pipeline for clean extraction and LLM summarization
 */

export interface ContentQualityResult {
  summary: string
  keyFacts: string[]
  notableQuotes: string[]
  context: string
  entities: string[]
  readingTime: number
}

export class ContentQualityPipeline {
  /**
   * Process content through the quality pipeline
   */
  async processContent(
    html: string,
    url: string,
    title: string
  ): Promise<ContentQualityResult> {
    console.log('[ContentQualityPipeline] Processing content for:', title.substring(0, 50))
    
    // Step 1: Clean HTML and extract readable content
    const cleanedContent = await this.cleanHtml(html, url)
    
    // Step 2: Normalize text
    const normalizedText = this.normalizeText(cleanedContent)
    
    // Step 3: Validate content quality
    if (!this.validateContent(normalizedText)) {
      throw new Error('Content quality too low - insufficient readable text')
    }
    
    // Step 4: Generate summary and facts using LLM
    const llmResult = await this.generateSummaryWithLLM(normalizedText, title, url)
    
    // Step 5: Extract entities and context
    const entities = this.extractEntities(normalizedText)
    const context = this.generateContext(normalizedText, entities)
    
    return {
      summary: llmResult.summary,
      keyFacts: llmResult.keyFacts,
      notableQuotes: llmResult.notableQuotes,
      context,
      entities,
      readingTime: Math.ceil(normalizedText.length / 1000)
    }
  }

  /**
   * Clean HTML and extract readable content
   */
  private async cleanHtml(html: string, url: string): Promise<string> {
    // Remove unwanted elements
    const unwantedSelectors = [
      'nav', 'header', 'footer', 'aside', 'form', '.menu', '.breadcrumbs',
      '.cookie', '.legal', '.newsletter', '.share', '.modal', '.overlay',
      '.ad', '[role="navigation"]', '.social', '.comments', '.related'
    ]
    
    let cleaned = html
    
    // Remove script and style tags
    cleaned = cleaned.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
    
    // Remove unwanted elements
    for (const selector of unwantedSelectors) {
      const regex = new RegExp(`<[^>]*class="[^"]*${selector.replace('.', '')}[^"]*"[^>]*>[\s\S]*?</[^>]*>`, 'gi')
      cleaned = cleaned.replace(regex, '')
    }
    
    // Remove empty paragraphs and divs
    cleaned = cleaned.replace(/<(p|div)[^>]*>\s*<\/\1>/gi, '')
    
    // Extract main content area
    const mainContent = this.extractMainContent(cleaned)
    
    return mainContent
  }

  /**
   * Extract main content from HTML
   */
  private extractMainContent(html: string): string {
    // Try to find main content area
    const mainSelectors = [
      'main', 'article', '.content', '.post-content', '.entry-content',
      '.article-content', '.story-content', '.main-content'
    ]
    
    for (const selector of mainSelectors) {
      const regex = new RegExp(`<[^>]*class="[^"]*${selector.replace('.', '')}[^"]*"[^>]*>(.*?)</[^>]*>`, 'gis')
      const match = html.match(regex)
      if (match && match[1]) {
        return match[1]
      }
    }
    
    // Fallback to body content
    const bodyMatch = html.match(/<body[^>]*>(.*?)<\/body>/gis)
    return bodyMatch ? bodyMatch[1] : html
  }

  /**
   * Normalize text content
   */
  private normalizeText(html: string): string {
    // Remove HTML tags
    let text = html.replace(/<[^>]*>/g, ' ')
    
    // Decode HTML entities
    text = text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
    
    // Collapse whitespace
    text = text.replace(/\s+/g, ' ').trim()
    
    // Remove common boilerplate
    const boilerplate = [
      'Subscribe to our newsletter',
      'Skip to main content',
      'Cookie Policy',
      'Privacy Policy',
      'Terms of Service',
      'Follow us on',
      'Share this article',
      'Related articles',
      'Advertisement',
      'Sponsored content'
    ]
    
    for (const phrase of boilerplate) {
      text = text.replace(new RegExp(phrase, 'gi'), '')
    }
    
    return text
  }

  /**
   * Validate content quality
   */
  private validateContent(text: string): boolean {
    // Must have at least 200 characters
    if (text.length < 200) return false
    
    // Must have at least 3 sentences
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10)
    if (sentences.length < 3) return false
    
    // Must not be mostly boilerplate
    const boilerplateRatio = this.calculateBoilerplateRatio(text)
    if (boilerplateRatio > 0.5) return false
    
    return true
  }

  /**
   * Calculate ratio of boilerplate content
   */
  private calculateBoilerplateRatio(text: string): number {
    const boilerplatePatterns = [
      /subscribe/gi,
      /newsletter/gi,
      /cookie/gi,
      /privacy/gi,
      /terms/gi,
      /follow us/gi,
      /share this/gi,
      /related/gi,
      /advertisement/gi,
      /sponsored/gi
    ]
    
    let boilerplateCount = 0
    for (const pattern of boilerplatePatterns) {
      const matches = text.match(pattern)
      if (matches) boilerplateCount += matches.length
    }
    
    return boilerplateCount / text.length
  }

  /**
   * Generate summary and facts using LLM
   */
  private async generateSummaryWithLLM(
    text: string,
    title: string,
    url: string
  ): Promise<{ summary: string; keyFacts: string[]; notableQuotes: string[] }> {
    try {
      const response = await fetch('/api/ai/summarize-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-key': process.env.INTERNAL_API_KEY || ''
        },
        body: JSON.stringify({
          text: text.substring(0, 1500), // Limit to first 1500 words
          title,
          url,
          temperature: 0.2 // Deterministic output
        })
      })

      if (!response.ok) {
        throw new Error(`LLM summarization failed: ${response.status}`)
      }

      const result = await response.json()
      
      // Validate LLM output
      if (!this.validateLLMOutput(result)) {
        throw new Error('LLM output validation failed')
      }
      
      return result
    } catch (error) {
      console.error('[ContentQualityPipeline] LLM summarization failed:', error)
      
      // Fallback to simple extraction
      return this.generateFallbackSummary(text)
    }
  }

  /**
   * Validate LLM output quality
   */
  private validateLLMOutput(result: any): boolean {
    if (!result.summary || result.summary.length < 80) return false
    if (!result.keyFacts || result.keyFacts.length < 3) return false
    
    // Check for boilerplate in output
    const boilerplate = ['Subscribe', 'Skip to main', 'Cookie Policy']
    const hasBoilerplate = boilerplate.some(phrase => 
      result.summary.includes(phrase)
    )
    
    if (hasBoilerplate) return false
    
    // Check for truncated content
    const hasTruncated = result.keyFacts.some((fact: string) => 
      fact.endsWith('...') || fact.length < 20
    )
    
    if (hasTruncated) return false
    
    return true
  }

  /**
   * Generate fallback summary when LLM fails
   */
  private generateFallbackSummary(text: string): { summary: string; keyFacts: string[]; notableQuotes: string[] } {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20)
    const summary = sentences.slice(0, 3).join('. ') + '.'
    
    const keyFacts = sentences
      .slice(3, 8)
      .filter(s => s.length > 30)
      .map(s => s.trim())
    
    return {
      summary,
      keyFacts,
      notableQuotes: []
    }
  }

  /**
   * Extract entities from text
   */
  private extractEntities(text: string): string[] {
    // Simple entity extraction - can be enhanced with NLP
    const entities: string[] = []
    
    // Look for capitalized words (potential entities)
    const capitalizedWords = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g)
    if (capitalizedWords) {
      entities.push(...capitalizedWords.slice(0, 10))
    }
    
    return [...new Set(entities)] // Remove duplicates
  }

  /**
   * Generate context for the content
   */
  private generateContext(text: string, entities: string[]): string {
    // Simple context generation - can be enhanced
    const context = `This article discusses ${entities.slice(0, 3).join(', ')} and related topics.`
    return context
  }
}
