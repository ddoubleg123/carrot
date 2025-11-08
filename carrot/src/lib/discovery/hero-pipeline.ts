/**
 * Robust hero image pipeline with multiple fallback strategies
 * Order: AI → Wikimedia → minSVG
 */

export interface HeroImageResult {
  url: string
  source: 'ai' | 'wikimedia' | 'skeleton'
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

export interface HeroInput {
  title: string
  summary?: string
  topic?: string
  entity?: string
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
  async assignHero(input: HeroInput): Promise<HeroImageResult> {
    // 1. Try AI generation first
    try {
      const aiResult = await this.tryAIGeneration(input)
      if (aiResult) {
        return aiResult
      }
    } catch (error) {
      console.warn('[Hero Pipeline] AI generation failed:', error)
    }
    
    // 2. Try Wikimedia fallback
    try {
      const wikiResult = await this.tryWikimedia(input)
      if (wikiResult) {
        return wikiResult
      }
    } catch (error) {
      console.warn('[Hero Pipeline] Wikimedia fallback failed:', error)
    }
    
    // 3. Ultimate fallback - skeleton SVG
    return this.createSkeleton(input)
  }
  
  /**
   * Try AI image generation
   */
  private async tryAIGeneration(item: HeroInput): Promise<HeroImageResult | null> {
    try {
      console.log(`[Hero Pipeline] Attempting AI generation for: ${item.title}`)
      
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)
      const response = await fetch(`${this.baseUrl}/api/ai/generate-hero-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: item.title,
          description: item.summary,
          topic: item.topic || item.entity || 'research',
          style: 'editorial',
          artisticStyle: 'photorealistic',
          enableHiresFix: true,
          useRefiner: true,
          useFaceRestoration: true,
          useRealesrgan: true
        }),
        signal: controller.signal
      }).finally(() => clearTimeout(timeout))
      
      console.log(`[Hero Pipeline] AI generation response status: ${response.status}`)
      
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
  private async tryWikimedia(item: HeroInput): Promise<HeroImageResult | null> {
    try {
      // Extract entity from title for Wikimedia search
      const primaryEntity = item.entity || this.extractEntityForWikimedia(item.title)
      if (!primaryEntity) {
        console.log(`[Hero Pipeline] No entity found for Wikimedia search in: ${item.title}`)
        return null
      }

      const searchTerms = [primaryEntity]
      if (item.topic && item.topic !== primaryEntity) {
        searchTerms.push(item.topic)
      }
      
      console.log(`[Hero Pipeline] Attempting Wikimedia search for entity: ${primaryEntity}`)
      
      const response = await fetch(`${this.baseUrl}/api/media/wikimedia-search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: searchTerms.join(' '),
          limit: 5
        })
      })
      
      console.log(`[Hero Pipeline] Wikimedia response status: ${response.status}`)
      
      if (!response.ok) {
        throw new Error(`Wikimedia search failed: ${response.status}`)
      }
      
      const data = await response.json()
      
      // wikimedia-search API returns { images: [{ url, thumbnail, ... }] }
      if (data.images && data.images.length > 0) {
        const image = data.images[0]
        console.log(`[Hero Pipeline] ✅ Found Wikimedia image: ${image.url}`)
        return {
          url: image.thumbnail || image.url,
          source: 'wikimedia',
          width: 1280,
          height: 720,
          alt: `Wikimedia image for ${item.title}`
        }
      }
      
      console.log(`[Hero Pipeline] No Wikimedia images found`)
      return null
    } catch (error) {
      console.warn('[Hero Pipeline] Wikimedia error:', error)
      return null
    }
  }
  
  /**
   * Create skeleton SVG fallback
   */
  private createSkeleton(item: HeroInput): HeroImageResult {
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
      source: 'skeleton',
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
    // Enhanced entity extraction for basketball content
    const titleLower = title.toLowerCase()
    
    // Known Bulls players (extract if in title)
    const bullsPlayers = [
      'Michael Jordan', 'Scottie Pippen', 'Dennis Rodman', 'Phil Jackson',
      'Derrick Rose', 'Zach LaVine', 'DeMar DeRozan', 'Nikola Vučević',
      'Coby White', 'Patrick Williams', 'Lonzo Ball'
    ]
    
    for (const player of bullsPlayers) {
      if (titleLower.includes(player.toLowerCase())) {
        return player
      }
    }
    
    // Extract team name
    if (titleLower.includes('bulls')) {
      return 'Chicago Bulls'
    }
    
    // Extract first proper noun (capitalized words) as entity
    const properNouns = title.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g)
    if (properNouns && properNouns.length > 0) {
      // Return the first multi-word proper noun (likely a person name)
      const multiWord = properNouns.find(noun => noun.split(/\s+/).length >= 2)
      if (multiWord) {
        return multiWord
      }
      // Or just return the first proper noun
      return properNouns[0]
    }
    
    return null
  }
  
  /**
   * Get color palette for item
   */
  private getColorPalette(item: HeroInput): string[] {
    // Default basketball colors
    const palettes = [
      ['#1e3a8a', '#3b82f6'], // Blue
      ['#dc2626', '#ef4444'], // Red
      ['#059669', '#10b981'], // Green
      ['#7c3aed', '#a855f7'], // Purple
      ['#ea580c', '#f97316']  // Orange
    ]
    
    // Use item hash to pick consistent colors
    const hash = this.simpleHash(item.title)
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