import { HeroOutput, HeroSource } from './hero-types'

/**
 * Process and optimize hero image through proxy pipeline
 * - Optimize via imgproxy (WebP 1280px)
 * - Generate blur placeholder
 * - Extract dominant color
 */
export async function proxyDecorate(src: string, source: HeroSource): Promise<HeroOutput> {
  console.log('[proxyDecorate] Processing image:', src.substring(0, 50), 'source:', source)
  
  try {
    // Step 1: Optimize image through imgproxy
    const optimizedUrl = await optimizeImage(src)
    
    // Step 2: Generate blur placeholder
    const blurDataURL = await generateBlurPlaceholder(src)
    
    // Step 3: Extract dominant color
    const dominant = await extractDominantColor(src)
    
    return {
      hero: optimizedUrl,
      blurDataURL,
      dominant,
      source,
      license: source === 'generated' ? 'generated' : 'source'
    }
  } catch (error) {
    console.warn('[proxyDecorate] Error processing image:', error)
    
    // Fallback: return original URL without processing
    return {
      hero: src,
      source,
      license: source === 'generated' ? 'generated' : 'source'
    }
  }
}

/**
 * Optimize image using imgproxy or Cloudflare Images
 */
async function optimizeImage(src: string): Promise<string> {
  try {
    // For now, use a simple proxy endpoint
    // In production, this would use imgproxy or Cloudflare Images
    const proxyUrl = `/api/media/proxy?url=${encodeURIComponent(src)}&w=1280&f=webp&q=80`
    return proxyUrl
  } catch (error) {
    console.warn('[optimizeImage] Failed to optimize, using original:', error)
    return src
  }
}

/**
 * Generate blur placeholder (10px blur, 8x8 resize)
 */
async function generateBlurPlaceholder(src: string): Promise<string | undefined> {
  try {
    // For data URLs, we can process them directly
    if (src.startsWith('data:')) {
      return await processDataUrlBlur(src)
    }
    
    // For remote URLs, we'd need to fetch and process
    // For now, return undefined - can be implemented with sharp
    console.log('[generateBlurPlaceholder] Remote URL blur not implemented yet')
    return undefined
  } catch (error) {
    console.warn('[generateBlurPlaceholder] Error:', error)
    return undefined
  }
}

/**
 * Extract dominant color
 */
async function extractDominantColor(src: string): Promise<string | undefined> {
  try {
    // For now, return a default color
    // In production, this would use color-thief or fast-average-color
    const defaultColors = {
      'og': '#667eea',
      'oembed': '#f093fb', 
      'inline': '#4facfe',
      'video': '#f5576c',
      'pdf': '#43e97b',
      'image': '#38f9d7',
      'generated': '#fa709a'
    }
    
    return defaultColors['generated'] // Default for now
  } catch (error) {
    console.warn('[extractDominantColor] Error:', error)
    return undefined
  }
}

/**
 * Process data URL to generate blur placeholder
 */
async function processDataUrlBlur(dataUrl: string): Promise<string | undefined> {
  try {
    // Extract base64 data
    const base64Data = dataUrl.split(',')[1]
    if (!base64Data) return undefined
    
    // Convert to buffer
    const buffer = Buffer.from(base64Data, 'base64')
    
    // For now, return a simple blurred version
    // In production, this would use sharp to resize and blur
    return dataUrl // Simplified for now
  } catch (error) {
    console.warn('[processDataUrlBlur] Error:', error)
    return undefined
  }
}
