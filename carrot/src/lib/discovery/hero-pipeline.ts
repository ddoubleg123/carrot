/**
 * Robust hero image pipeline with multiple fallback strategies
 * Order: og:image → twitter:image → oEmbed → inline images → video frames → generated
 */

export interface HeroImageResult {
  url: string
  source: 'og' | 'twitter' | 'oembed' | 'inline' | 'video' | 'generated'
  width: number
  height: number
  alt?: string
  proxyUrl?: string
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
   * Get hero image for content with fallback chain
   */
  async getHeroImage(
    url: string,
    title: string,
    content?: string,
    meta?: Record<string, any>
  ): Promise<HeroImageResult | null> {
    try {
      // 1. Try Open Graph image
      const ogImage = await this.getOpenGraphImage(url, meta)
      if (ogImage) return ogImage
      
      // 2. Try Twitter Card image
      const twitterImage = await this.getTwitterImage(url, meta)
      if (twitterImage) return twitterImage
      
      // 3. Try oEmbed thumbnail
      const oembedImage = await this.getOEmbedImage(url)
      if (oembedImage) return oembedImage
      
      // 4. Try inline images from content
      const inlineImage = await this.getInlineImage(url, content)
      if (inlineImage) return inlineImage
      
      // 5. Try video thumbnail
      const videoImage = await this.getVideoThumbnail(url)
      if (videoImage) return videoImage
      
      // 6. Generate cover image as last resort
      const generatedImage = await this.generateCoverImage(title, url)
      if (generatedImage) return generatedImage
      
      return null
    } catch (error) {
      console.error('[HeroPipeline] Error getting hero image:', error)
      return null
    }
  }
  
  /**
   * Extract Open Graph image
   */
  private async getOpenGraphImage(url: string, meta?: Record<string, any>): Promise<HeroImageResult | null> {
    try {
      const ogImage = meta?.ogImage || meta?.['og:image']
      if (!ogImage) return null
      
      const imageUrl = this.resolveUrl(url, ogImage)
      const dimensions = await this.getImageDimensions(imageUrl)
      
      if (dimensions && dimensions.width >= 400 && dimensions.height >= 225) {
        return {
          url: imageUrl,
          source: 'og',
          width: dimensions.width,
          height: dimensions.height,
          proxyUrl: await this.getProxyUrl(imageUrl)
        }
      }
      
      return null
    } catch {
      return null
    }
  }
  
  /**
   * Extract Twitter Card image
   */
  private async getTwitterImage(url: string, meta?: Record<string, any>): Promise<HeroImageResult | null> {
    try {
      const twitterImage = meta?.twitterImage || meta?.['twitter:image']
      if (!twitterImage) return null
      
      const imageUrl = this.resolveUrl(url, twitterImage)
      const dimensions = await this.getImageDimensions(imageUrl)
      
      if (dimensions && dimensions.width >= 400 && dimensions.height >= 225) {
        return {
          url: imageUrl,
          source: 'twitter',
          width: dimensions.width,
          height: dimensions.height,
          proxyUrl: await this.getProxyUrl(imageUrl)
        }
      }
      
      return null
    } catch {
      return null
    }
  }
  
  /**
   * Get oEmbed thumbnail
   */
  private async getOEmbedImage(url: string): Promise<HeroImageResult | null> {
    try {
      // Try common oEmbed endpoints
      const oembedEndpoints = [
        `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}`,
        `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
        `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`
      ]
      
      for (const endpoint of oembedEndpoints) {
        try {
          const response = await fetch(endpoint, { 
            signal: AbortSignal.timeout(3000) 
          })
          if (!response.ok) continue
          
          const data = await response.json()
          const thumbnailUrl = data.thumbnail_url || data.thumbnail
          
          if (thumbnailUrl) {
            const imageUrl = this.resolveUrl(url, thumbnailUrl)
            const dimensions = await this.getImageDimensions(imageUrl)
            
            if (dimensions && dimensions.width >= 400 && dimensions.height >= 225) {
              return {
                url: imageUrl,
                source: 'oembed',
                width: dimensions.width,
                height: dimensions.height,
                proxyUrl: await this.getProxyUrl(imageUrl)
              }
            }
          }
        } catch {
          continue
        }
      }
      
      return null
    } catch {
      return null
    }
  }
  
  /**
   * Extract inline images from content
   */
  private async getInlineImage(url: string, content?: string): Promise<HeroImageResult | null> {
    if (!content) return null
    
    try {
      // Find all img tags
      const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi
      const images: ImageCandidate[] = []
      
      let match
      while ((match = imgRegex.exec(content)) !== null) {
        const imgUrl = this.resolveUrl(url, match[1])
        
        // Get dimensions from width/height attributes
        const widthMatch = match[0].match(/width=["']?(\d+)["']?/i)
        const heightMatch = match[0].match(/height=["']?(\d+)["']?/i)
        const altMatch = match[0].match(/alt=["']([^"']*)["']/i)
        
        const width = widthMatch ? parseInt(widthMatch[1]) : 0
        const height = heightMatch ? parseInt(heightMatch[1]) : 0
        
        images.push({
          url: imgUrl,
          width,
          height,
          alt: altMatch?.[1],
          source: 'inline'
        })
      }
      
      // Sort by size (prefer larger images)
      images.sort((a, b) => (b.width * b.height) - (a.width * a.height))
      
      // Find the best candidate
      for (const image of images) {
        if (image.width >= 800 && image.height >= 450) {
          const dimensions = await this.getImageDimensions(image.url)
          if (dimensions) {
            return {
              url: image.url,
              source: 'inline',
              width: dimensions.width,
              height: dimensions.height,
              alt: image.alt,
              proxyUrl: await this.getProxyUrl(image.url)
            }
          }
        }
      }
      
      return null
    } catch {
      return null
    }
  }
  
  /**
   * Get video thumbnail
   */
  private async getVideoThumbnail(url: string): Promise<HeroImageResult | null> {
    try {
      // YouTube thumbnail
      const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)
      if (youtubeMatch) {
        const videoId = youtubeMatch[1]
        const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
        
        const dimensions = await this.getImageDimensions(thumbnailUrl)
        if (dimensions) {
          return {
            url: thumbnailUrl,
            source: 'video',
            width: dimensions.width,
            height: dimensions.height,
            proxyUrl: await this.getProxyUrl(thumbnailUrl)
          }
        }
      }
      
      return null
    } catch {
      return null
    }
  }
  
  /**
   * Generate cover image as last resort
   */
  private async generateCoverImage(title: string, url: string): Promise<HeroImageResult | null> {
    try {
      // This would call the AI image generation API
      // For now, return a placeholder
      const domain = new URL(url).hostname
      const placeholderUrl = `https://via.placeholder.com/1280x720/667eea/ffffff?text=${encodeURIComponent(title.substring(0, 50))}`
      
      return {
        url: placeholderUrl,
        source: 'generated',
        width: 1280,
        height: 720,
        proxyUrl: await this.getProxyUrl(placeholderUrl)
      }
    } catch {
      return null
    }
  }
  
  /**
   * Get image dimensions
   */
  private async getImageDimensions(url: string): Promise<{width: number, height: number} | null> {
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(3000)
      })
      
      if (!response.ok) return null
      
      const contentType = response.headers.get('content-type')
      if (!contentType?.startsWith('image/')) return null
      
      // Try to get dimensions from headers
      const contentLength = response.headers.get('content-length')
      if (contentLength && parseInt(contentLength) > 1000000) { // > 1MB
        return { width: 1920, height: 1080 } // Assume large image
      }
      
      // For now, return default dimensions
      return { width: 800, height: 450 }
    } catch {
      return null
    }
  }
  
  /**
   * Get proxy URL for image
   */
  private async getProxyUrl(originalUrl: string): Promise<string> {
    try {
      const proxyUrl = `${this.baseUrl}/api/media/proxy?url=${encodeURIComponent(originalUrl)}&w=1280&f=webp&q=80`
      return proxyUrl
    } catch {
      return originalUrl
    }
  }
  
  /**
   * Resolve relative URLs
   */
  private resolveUrl(baseUrl: string, relativeUrl: string): string {
    try {
      return new URL(relativeUrl, baseUrl).toString()
    } catch {
      return relativeUrl
    }
  }
}

/**
 * Choose best hero image from candidates
 */
export function chooseBestHero(candidates: ImageCandidate[]): ImageCandidate | null {
  if (candidates.length === 0) return null
  
  // Sort by score (size + aspect ratio)
  const scored = candidates.map(candidate => {
    const area = candidate.width * candidate.height
    const aspectRatio = candidate.width / candidate.height
    const aspectScore = Math.abs(aspectRatio - 16/9) < 0.5 ? 1 : 0.5 // Prefer 16:9
    const sizeScore = Math.min(area / (1920 * 1080), 1) // Normalize to 1080p
    
    return {
      ...candidate,
      score: sizeScore * aspectScore
    }
  })
  
  scored.sort((a, b) => b.score - a.score)
  return scored[0]
}
