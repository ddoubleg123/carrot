/**
 * Hero image fallback pipeline
 * Tries Wikimedia Commons, OpenVerse, then skeleton
 */

export interface HeroFallbackResult {
  url: string
  source: 'wikimedia' | 'openverse' | 'skeleton'
  attribution?: string
  width?: number
  height?: number
}

/**
 * Search Wikimedia Commons for images
 */
export async function searchWikimediaCommons(
  topic: string,
  aliases: string[] = []
): Promise<HeroFallbackResult | null> {
  try {
    const searchTerms = [topic, ...aliases].slice(0, 3)
    
    for (const term of searchTerms) {
      // Wikimedia Commons API
      const apiUrl = `https://commons.wikimedia.org/w/api.php?action=query&format=json&list=search&srsearch=${encodeURIComponent(term)}&srnamespace=6&srlimit=5`
      
      const response = await fetch(apiUrl, {
        headers: { 'User-Agent': 'CarrotCrawler/1.0' }
      })
      
      if (!response.ok) continue
      
      const data = await response.json()
      const results = data.query?.search || []
      
      if (results.length > 0) {
        const firstResult = results[0]
        const imageUrl = `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(firstResult.title)}`
        
        // Get image URL
        const imageInfoUrl = `https://commons.wikimedia.org/w/api.php?action=query&format=json&titles=${encodeURIComponent(firstResult.title)}&prop=imageinfo&iiprop=url`
        const imageResponse = await fetch(imageInfoUrl, {
          headers: { 'User-Agent': 'CarrotCrawler/1.0' }
        })
        
        if (imageResponse.ok) {
          const imageData = await imageResponse.json()
          const pages = imageData.query?.pages || {}
          const page = Object.values(pages)[0] as any
          const imageUrl = page?.imageinfo?.[0]?.url
          
          if (imageUrl) {
            return {
              url: imageUrl,
              source: 'wikimedia',
              attribution: `Wikimedia Commons: ${firstResult.title}`
            }
          }
        }
      }
    }
    
    return null
  } catch (error) {
    console.warn('[Hero Fallback] Wikimedia search failed:', error)
    return null
  }
}

/**
 * Search OpenVerse for CC-licensed images
 */
export async function searchOpenVerse(
  topic: string,
  license: string = 'cc0,cc-by'
): Promise<HeroFallbackResult | null> {
  try {
    const apiUrl = `https://api.openverse.engineering/v1/images/?q=${encodeURIComponent(topic)}&license=${license}&page_size=5`
    
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'CarrotCrawler/1.0',
        'Accept': 'application/json'
      }
    })
    
    if (!response.ok) return null
    
    const data = await response.json()
    const results = data.results || []
    
    if (results.length > 0) {
      const firstResult = results[0]
      return {
        url: firstResult.url || firstResult.thumbnail,
        source: 'openverse',
        attribution: firstResult.attribution || 'OpenVerse',
        width: firstResult.width,
        height: firstResult.height
      }
    }
    
    return null
  } catch (error) {
    console.warn('[Hero Fallback] OpenVerse search failed:', error)
    return null
  }
}

/**
 * Generate skeleton/placeholder image
 */
export function generateSkeletonHero(topic: string): HeroFallbackResult {
  // Return a branded placeholder URL
  // In production, this could be a generated SVG or a static placeholder
  const placeholderUrl = `https://via.placeholder.com/1280x720/4A5568/FFFFFF?text=${encodeURIComponent(topic)}`
  
  return {
    url: placeholderUrl,
    source: 'skeleton',
    width: 1280,
    height: 720
  }
}

/**
 * Try hero image fallback pipeline in order
 */
export async function tryHeroFallback(
  topic: string,
  aliases: string[] = [],
  license: string = 'cc0-or-cc-by'
): Promise<HeroFallbackResult> {
  // Try Wikimedia first
  const wikimedia = await searchWikimediaCommons(topic, aliases)
  if (wikimedia) return wikimedia
  
  // Try OpenVerse
  const openverse = await searchOpenVerse(topic, license)
  if (openverse) return openverse
  
  // Fall back to skeleton
  return generateSkeletonHero(topic)
}

