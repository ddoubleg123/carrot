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
    const sharp = await import('sharp').then(m => m.default)
    
    let imageBuffer: Buffer
    
    // Handle data URLs
    if (src.startsWith('data:')) {
      const base64Data = src.split(',')[1]
      if (!base64Data) return undefined
      imageBuffer = Buffer.from(base64Data, 'base64')
    } 
    // Handle remote URLs
    else {
      const response = await fetch(src, { 
        signal: AbortSignal.timeout(10000) 
      })
      if (!response.ok) return undefined
      imageBuffer = Buffer.from(await response.arrayBuffer())
    }
    
    // Generate tiny blurred version
    const blurredBuffer = await sharp(imageBuffer)
      .resize(8, 8, { fit: 'cover' })
      .blur(2)
      .jpeg({ quality: 50 })
      .toBuffer()
    
    const blurBase64 = blurredBuffer.toString('base64')
    return `data:image/jpeg;base64,${blurBase64}`
    
  } catch (error) {
    console.warn('[generateBlurPlaceholder] Error:', error)
    return undefined
  }
}

/**
 * Extract dominant color using sharp
 */
async function extractDominantColor(src: string): Promise<string | undefined> {
  try {
    const sharp = await import('sharp').then(m => m.default)
    
    let imageBuffer: Buffer
    
    // Handle data URLs
    if (src.startsWith('data:')) {
      const base64Data = src.split(',')[1]
      if (!base64Data) return undefined
      imageBuffer = Buffer.from(base64Data, 'base64')
    } 
    // Handle remote URLs
    else {
      const response = await fetch(src, { 
        signal: AbortSignal.timeout(10000) 
      })
      if (!response.ok) return undefined
      imageBuffer = Buffer.from(await response.arrayBuffer())
    }
    
    // Extract dominant color by getting average color from small resize
    const { data } = await sharp(imageBuffer)
      .resize(1, 1, { fit: 'cover' })
      .raw()
      .toBuffer({ resolveWithObject: true })
    
    // Convert RGB to hex
    const r = data[0]
    const g = data[1]
    const b = data[2]
    const hex = `#${[r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')}`
    
    return hex
    
  } catch (error) {
    console.warn('[extractDominantColor] Error:', error)
    // Return a nice default based on common patterns
    return '#667eea'
  }
}
