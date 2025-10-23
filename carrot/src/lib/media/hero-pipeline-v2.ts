import { DiscoveredItem } from '@/types/discovered-content'

/**
 * Enhanced hero image pipeline with AI-first, Wikimedia fallback approach
 */

export interface HeroPipelineResult {
  heroUrl: string
  mediaSource: 'ai' | 'wiki' | 'og' | 'placeholder'
  dominantColor?: string
  width?: number
  height?: number
}

/**
 * Two-step hero pipeline:
 * 1. AI generation (primary)
 * 2. Wikimedia fallback (secondary)
 */
export async function generateHeroImage(item: DiscoveredItem): Promise<HeroPipelineResult> {
  console.log('[HeroPipeline] Starting hero generation for:', item.title.substring(0, 50))
  
  // Step 1: Try AI generation first
  try {
    const aiResult = await generateAIHero(item)
    if (aiResult.heroUrl) {
      console.log('[HeroPipeline] ✅ AI generation successful')
      return aiResult
    }
  } catch (error) {
    console.warn('[HeroPipeline] AI generation failed:', error)
  }
  
  // Step 2: Try Wikimedia fallback
  try {
    const wikiResult = await generateWikimediaHero(item)
    if (wikiResult.heroUrl) {
      console.log('[HeroPipeline] ✅ Wikimedia fallback successful')
      return wikiResult
    }
  } catch (error) {
    console.warn('[HeroPipeline] Wikimedia fallback failed:', error)
  }
  
  // Step 3: Use OG image as last resort
  if (item.media?.hero) {
    console.log('[HeroPipeline] Using existing OG image')
    return {
      heroUrl: item.media.hero,
      mediaSource: 'og'
    }
  }
  
  // Step 4: Placeholder fallback
  console.log('[HeroPipeline] Using placeholder fallback')
  return {
    heroUrl: generatePlaceholderUrl(item),
    mediaSource: 'placeholder'
  }
}

/**
 * Generate AI hero image using our AI service
 */
async function generateAIHero(item: DiscoveredItem): Promise<HeroPipelineResult> {
  try {
    const response = await fetch('/api/ai/generate-hero-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-key': process.env.INTERNAL_API_KEY || ''
      },
      body: JSON.stringify({
        title: item.title,
        summary: item.content.summary150,
        sourceDomain: item.meta?.sourceDomain,
        contentType: item.type,
        patchTheme: 'Sports' // Default for Bulls content
      })
    })

    if (!response.ok) {
      throw new Error(`AI generation failed: ${response.status}`)
    }

    const result = await response.json()
    
    if (result.success && result.imageUrl) {
      return {
        heroUrl: result.imageUrl,
        mediaSource: 'ai',
        dominantColor: result.dominantColor,
        width: result.width,
        height: result.height
      }
    }
    
    throw new Error('AI generation returned no image')
  } catch (error) {
    console.error('[generateAIHero] Error:', error)
    throw error
  }
}

/**
 * Generate Wikimedia hero image using entity search
 */
async function generateWikimediaHero(item: DiscoveredItem): Promise<HeroPipelineResult> {
  try {
    // Extract entities from title and content for Wikimedia search
    const entities = extractEntitiesForSearch(item)
    
    for (const entity of entities) {
      try {
        const response = await fetch('/api/media/wikimedia-search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-key': process.env.INTERNAL_API_KEY || ''
          },
          body: JSON.stringify({
            query: entity,
            limit: 1
          })
        })

        if (response.ok) {
          const result = await response.json()
          if (result.images && result.images.length > 0) {
            const image = result.images[0]
            return {
              heroUrl: image.url,
              mediaSource: 'wiki',
              dominantColor: image.dominantColor,
              width: image.width,
              height: image.height
            }
          }
        }
      } catch (error) {
        console.warn(`[generateWikimediaHero] Failed for entity "${entity}":`, error)
        continue
      }
    }
    
    throw new Error('No Wikimedia images found')
  } catch (error) {
    console.error('[generateWikimediaHero] Error:', error)
    throw error
  }
}

/**
 * Extract searchable entities from item content
 */
function extractEntitiesForSearch(item: DiscoveredItem): string[] {
  const entities: string[] = []
  
  // Extract from title
  const title = item.title.toLowerCase()
  if (title.includes('chicago bulls')) entities.push('Chicago Bulls')
  if (title.includes('michael jordan')) entities.push('Michael Jordan')
  if (title.includes('scottie pippen')) entities.push('Scottie Pippen')
  if (title.includes('dennis rodman')) entities.push('Dennis Rodman')
  if (title.includes('phil jackson')) entities.push('Phil Jackson')
  if (title.includes('derrick rose')) entities.push('Derrick Rose')
  if (title.includes('demar derozan')) entities.push('DeMar DeRozan')
  if (title.includes('zach lavine')) entities.push('Zach LaVine')
  if (title.includes('nikola vucevic')) entities.push('Nikola Vučević')
  if (title.includes('united center')) entities.push('United Center')
  
  // Extract from content
  const content = (item.content.summary150 || '').toLowerCase()
  if (content.includes('chicago bulls')) entities.push('Chicago Bulls')
  if (content.includes('nba')) entities.push('NBA')
  if (content.includes('basketball')) entities.push('Basketball')
  
  // Remove duplicates and return
  return [...new Set(entities)]
}

/**
 * Generate placeholder URL for fallback
 */
function generatePlaceholderUrl(item: DiscoveredItem): string {
  const domain = item.meta?.sourceDomain || 'unknown'
  const title = encodeURIComponent(item.title.substring(0, 50))
  return `https://ui-avatars.com/api/?name=${title}&background=667eea&color=fff&size=400`
}

/**
 * Update item with new hero image
 */
export async function updateItemWithHero(item: DiscoveredItem, result: HeroPipelineResult): Promise<void> {
  try {
    const response = await fetch('/api/internal/update-hero-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-key': process.env.INTERNAL_API_KEY || ''
      },
      body: JSON.stringify({
        postId: item.id,
        heroUrl: result.heroUrl,
        mediaSource: result.mediaSource,
        width: result.width,
        height: result.height
      })
    })

    if (!response.ok) {
      throw new Error(`Failed to update hero image: ${response.status}`)
    }

    console.log('[updateItemWithHero] ✅ Successfully updated item with hero image')
  } catch (error) {
    console.error('[updateItemWithHero] Error:', error)
    throw error
  }
}
