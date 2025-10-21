/**
 * Robust hero image pipeline with multiple fallback strategies
 * Order: AI → Wikimedia → minSVG
 */

export interface HeroImageResult {
  url: string
  source: 'ai' | 'wikimedia' | 'minsvg'
  width: number
  height: number
  alt?: string
  proxyUrl?: string
  dominantColor?: string
  blurHash?: string
}

export interface ImageCandidate {
  url: string
  width: number
  height: number
  alt?: string
  source: string
}

/**
 * Hero image pipeline with fallback chain
 */
export class HeroImagePipeline {
  private baseUrl: string
  
  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl
  }
  
  /**
   * Assign hero image with fallback chain
   */
  async assignHero(item: any): Promise<HeroImageResult> {
    // 1. Try AI generation first
    try {
      const aiResult = await this.tryAIGeneration(item)
      if (aiResult) {
        return aiResult
      }
    } catch (error) {
      console.warn('[Hero Pipeline] AI generation failed:', error)
    }
    
    // 2. Try Wikimedia fallback
    try {
      const wikiResult = await this.tryWikimedia(item)
      if (wikiResult) {
        return wikiResult
      }
    } catch (error) {
      console.warn('[Hero Pipeline] Wikimedia fallback failed:', error)
    }
    
    // 3. Ultimate fallback - minimal SVG
    return this.createMinimalSVG(item)
  }
  
  /**
   * Try AI image generation
   */
  private async tryAIGeneration(item: any): Promise<HeroImageResult | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/ai/generate-hero-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: item.title,
          description: item.content?.summary150 || item.description,
          topic: item.metadata?.topic || 'basketball',
          style: 'editorial'
        })
      })
      
      if (!response.ok) {
        throw new Error(`AI generation failed: ${response.status}`)
      }
      
      const data = await response.json()
      
      if (data.success && data.imageUrl) {
        return {
          url: data.imageUrl,
          source: 'ai',
          width: 1280,
          height: 720,
          alt: `AI generated image for ${item.title}`,
          dominantColor: data.dominantColor,
          blurHash: data.blurHash
        }
      }
      
      return null
    } catch (error) {
      console.warn('[Hero Pipeline] AI generation error:', error)
      return null
    }
  }
  
  /**
   * Try Wikimedia Commons
   */
  private async tryWikimedia(item: any): Promise<HeroImageResult | null> {
    try {
      // Extract entity from title for Wikimedia search
      const entity = this.extractEntityForWikimedia(item.title)
      if (!entity) return null
      
      const response = await fetch(`${this.baseUrl}/api/media/wikimedia`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          entity,
          title: item.title
        })
      })
      
      if (!response.ok) {
        throw new Error(`Wikimedia search failed: ${response.status}`)
      }
      
      const data = await response.json()
      
      if (data.success && data.imageUrl) {
        return {
          url: data.imageUrl,
          source: 'wikimedia',
          width: data.width || 1280,
          height: data.height || 720,
          alt: `Wikimedia image for ${item.title}`,
          dominantColor: data.dominantColor
        }
      }
      
      return null
    } catch (error) {
      console.warn('[Hero Pipeline] Wikimedia error:', error)
      return null
    }
  }
  
  /**
   * Create minimal SVG fallback
   */
  private createMinimalSVG(item: any): HeroImageResult {
    const colors = this.getColorPalette(item)
    const gradient = `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`
    
    const svg = `
      <svg width="1280" height="720" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:${colors[0]};stop-opacity:1" />
            <stop offset="100%" style="stop-color:${colors[1]};stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#grad)" />
        <text x="50%" y="50%" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="48" font-weight="bold">
          ${this.truncateTitle(item.title, 30)}
        </text>
      </svg>
    `
    
    const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
    
    return {
      url: dataUrl,
      source: 'minsvg',
      width: 1280,
      height: 720,
      alt: `Minimal design for ${item.title}`,
      dominantColor: colors[0]
    }
  }
  
  /**
   * Extract entity for Wikimedia search
   */
  private extractEntityForWikimedia(title: string): string | null {
    // Simple entity extraction - could be enhanced with NER
    const basketballTerms = ['basketball', 'NBA', 'team', 'player', 'coach']
    const words = title.toLowerCase().split(/\s+/)
    
    for (const word of words) {
      if (basketballTerms.includes(word)) {
        // Find the team or player name
        const teamIndex = words.indexOf(word)
        if (teamIndex > 0) {
          return words[teamIndex - 1]
        }
      }
    }
    
    return null
  }
  
  /**
   * Get color palette for item
   */
  private getColorPalette(item: any): string[] {
    // Default basketball colors
    const palettes = [
      ['#1e3a8a', '#3b82f6'], // Blue
      ['#dc2626', '#ef4444'], // Red
      ['#059669', '#10b981'], // Green
      ['#7c3aed', '#a855f7'], // Purple
      ['#ea580c', '#f97316']  // Orange
    ]
    
    // Use item hash to pick consistent colors
    const hash = this.simpleHash(item.id || item.title)
    return palettes[hash % palettes.length]
  }
  
  /**
   * Simple hash function
   */
  private simpleHash(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash)
  }
  
  /**
   * Truncate title for display
   */
  private truncateTitle(title: string, maxLength: number): string {
    if (title.length <= maxLength) return title
    return title.substring(0, maxLength - 3) + '...'
  }
  
  /**
   * Save hero image to database
   */
  async saveHero(itemId: string, heroUrl: string, source: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/internal/update-hero-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          itemId,
          heroUrl,
          source
        })
      })
      
      if (!response.ok) {
        throw new Error(`Failed to save hero image: ${response.status}`)
      }
    } catch (error) {
      console.error('[Hero Pipeline] Failed to save hero image:', error)
      throw error
    }
  }
}