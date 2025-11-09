import { Prisma } from '@prisma/client'

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
  guideTopic?: string
}

const HERO_GENERATION_ENDPOINT = '/api/ai/generate-hero-image'
const WIKIMEDIA_ENDPOINT = '/api/media/wikimedia-search'

/**
 * Hero image pipeline with fallback chain
 */
export class HeroImagePipeline {
  private baseUrl: string
  
  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl
  }
  
  async assignHero(input: HeroInput): Promise<HeroImageResult> {
    const aiResult = await this.tryWithTimeout(() => this.tryAIGeneration(input), 5000)
    if (aiResult) return aiResult

    const wikiResult = await this.tryWithTimeout(() => this.tryWikimedia(input), 4000)
    if (wikiResult) return wikiResult

    return this.createSkeleton(input)
  }

  private async tryWithTimeout<T>(operation: () => Promise<T>, timeoutMs: number): Promise<T | null> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const result = await operation()
      return result
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') {
        console.warn('[Hero Pipeline] Operation timed out')
      }
      return null
    } finally {
      clearTimeout(timeout)
    }
  }

  private buildPayload(input: HeroInput) {
    return {
      title: input.title,
      description: input.summary,
      topic: input.topic || input.entity || input.guideTopic || 'research',
      style: 'editorial',
      artisticStyle: 'photorealistic',
      enableHiresFix: true,
      useRefiner: true,
      useFaceRestoration: true,
      useRealesrgan: true
    }
  }

  /**
   * Try AI image generation
   */
  private async tryAIGeneration(item: HeroInput): Promise<HeroImageResult | null> {
    try {
      const response = await fetch(`${this.baseUrl}${HERO_GENERATION_ENDPOINT}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.buildPayload(item))
      })

      if (!response.ok) {
        throw new Error(`AI generation failed: ${response.status}`)
      }

      const data = await response.json()
      if (data.success && data.imageUrl) {
        return {
          url: data.imageUrl,
          source: 'ai',
          width: data.width ?? 1280,
          height: data.height ?? 720,
          alt: data.alt || `AI generated image for ${item.title}`,
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
    const primaryEntity = item.entity || this.extractEntityForWikimedia(item.title)
    if (!primaryEntity) {
      return null
    }

    const searchTerms = [primaryEntity]
    if (item.topic && item.topic !== primaryEntity) {
      searchTerms.push(item.topic)
    }

    try {
      const response = await fetch(`${this.baseUrl}${WIKIMEDIA_ENDPOINT}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchTerms.join(' '), limit: 5 })
      })

      if (!response.ok) {
        throw new Error(`Wikimedia search failed: ${response.status}`)
      }

      const data = await response.json()
      if (Array.isArray(data.images) && data.images.length > 0) {
        const image = data.images[0]
        return {
          url: image.thumbnail || image.url,
          source: 'wikimedia',
          width: image.width ?? 1280,
          height: image.height ?? 720,
          alt: image.alt || `Wikimedia image for ${item.title}`
        }
      }
      return null
    } catch (error) {
      console.warn('[Hero Pipeline] Wikimedia fallback failed:', error)
      return null
    }
  }
  
  /**
   * Create skeleton SVG fallback
   */
  private createSkeleton(item: HeroInput): HeroImageResult {
    const colors = this.getColorPalette(item)
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
      alt: `Placeholder for ${item.title}`,
      dominantColor: colors[0]
    }
  }
  
  /**
   * Extract entity for Wikimedia search
   */
  private extractEntityForWikimedia(title: string): string | null {
    const titleLower = title.toLowerCase()
    const properNouns = title.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g)
    if (properNouns && properNouns.length > 0) {
      const multiWord = properNouns.find(noun => noun.split(/\s+/).length >= 2)
      return multiWord || properNouns[0]
    }
    if (titleLower.includes('bulls')) {
      return 'Chicago Bulls'
    }
    return null
  }
  
  /**
   * Get color palette for item
   */
  private getColorPalette(item: HeroInput): string[] {
    const palettes = [
      ['#1e3a8a', '#3b82f6'],
      ['#dc2626', '#ef4444'],
      ['#059669', '#10b981'],
      ['#7c3aed', '#a855f7'],
      ['#ea580c', '#f97316']
    ]

    const hash = this.simpleHash(item.title + (item.topic || '') + (item.entity || ''))
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
      hash = hash & hash
    }
    return Math.abs(hash)
  }
  
  /**
   * Truncate title for display
   */
  private truncateTitle(title: string, maxLength: number): string {
    if (title.length <= maxLength) return title
    return `${title.substring(0, maxLength - 3)}...`
  }

  appendHeroMetadata(hero: HeroImageResult): Prisma.JsonObject {
    return {
      source: hero.source,
      dominantColor: hero.dominantColor,
      blurHash: hero.blurHash
    } as Prisma.JsonObject
  }
}