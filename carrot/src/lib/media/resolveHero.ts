import { HeroInput, HeroOutput, HeroSource, HeroLicense } from './hero-types'
import { getOpenGraphImage } from './getOpenGraphImage'
import { getOEmbedImage } from './getOEmbedImage'
import { getFirstInlineImage } from './getFirstInlineImage'
import { extractVideoFrame, renderPdfFirstPage } from './derived'
import { generateProgrammaticCover } from './generateProgrammaticCover'
import { proxyDecorate } from './proxyDecorate'

/**
 * 4-tier hero resolution pipeline
 * 1. Open Graph & oEmbed (highest priority)
 * 2. Inline content extraction (for articles)
 * 3. Asset-derived media (for videos/PDFs/images)
 * 4. Programmatic generation (last resort)
 */
export async function resolveHero(input: HeroInput): Promise<HeroOutput> {
  console.log('[resolveHero] Starting hero resolution for:', { type: input.type, url: input.url?.substring(0, 50) })

  // Tier 1: Open Graph & oEmbed
  if (input.url) {
    try {
      console.log('[resolveHero] Tier 1: Trying Open Graph/oEmbed')
      
      // Try Open Graph first
      const ogResult = await getOpenGraphImage(input.url)
      if (ogResult) {
        console.log('[resolveHero] Found OG image:', ogResult.url.substring(0, 50))
        return await proxyDecorate(ogResult.url, ogResult.source)
      }

      // Fallback to oEmbed
      const oembedResult = await getOEmbedImage(input.url)
      if (oembedResult) {
        console.log('[resolveHero] Found oEmbed image:', oembedResult.url.substring(0, 50))
        return await proxyDecorate(oembedResult.url, oembedResult.source)
      }
    } catch (error) {
      console.warn('[resolveHero] Tier 1 failed:', error)
    }

    // Tier 2: Inline content extraction (for articles)
    if (input.type === 'article') {
      try {
        console.log('[resolveHero] Tier 2: Trying inline image extraction')
        const inlineResult = await getFirstInlineImage(input.url)
        if (inlineResult) {
          console.log('[resolveHero] Found inline image:', inlineResult.url.substring(0, 50))
          return await proxyDecorate(inlineResult.url, 'inline')
        }
      } catch (error) {
        console.warn('[resolveHero] Tier 2 failed:', error)
      }
    }
  }

  // Tier 3: Asset-derived media
  if (input.assetUrl) {
    try {
      console.log('[resolveHero] Tier 3: Trying asset-derived media')
      
      if (input.type === 'video') {
        const frameResult = await extractVideoFrame(input.assetUrl)
        if (frameResult) {
          console.log('[resolveHero] Extracted video frame')
          return await proxyDecorate(frameResult, 'video')
        }
      }

      if (input.type === 'pdf') {
        const pageResult = await renderPdfFirstPage(input.assetUrl)
        if (pageResult) {
          console.log('[resolveHero] Rendered PDF first page')
          return await proxyDecorate(pageResult, 'pdf')
        }
      }

      if (input.type === 'image') {
        console.log('[resolveHero] Using direct image asset')
        return await proxyDecorate(input.assetUrl, 'image')
      }
    } catch (error) {
      console.warn('[resolveHero] Tier 3 failed:', error)
    }
  }

  // Tier 4: AI Image Generation (new tier for custom images)
  if (input.title && input.summary) {
    try {
      console.log('[resolveHero] Tier 4: Attempting AI image generation')
      
      // Import the AI generation function directly to avoid fetch issues
      const { generateAIImage } = await import('./aiImageGenerator')
      const aiResult = await generateAIImage({
        title: input.title,
        summary: input.summary,
        sourceDomain: input.url ? new URL(input.url).hostname : undefined,
        contentType: input.type,
        patchTheme: input.patchTheme
      })

      if (aiResult && aiResult.success && aiResult.imageUrl) {
        console.log('[resolveHero] AI image generated successfully')
        return {
          hero: aiResult.imageUrl,
          blurDataURL: undefined,
          dominant: '#667eea',
          source: 'ai-generated',
          license: 'generated'
        }
      }
      
      console.log('[resolveHero] AI image generation failed, falling back to programmatic cover')
    } catch (error) {
      console.warn('[resolveHero] AI image generation failed:', error)
    }
  }

  // Tier 5: Programmatic generation (last resort - CANNOT FAIL)
  try {
    console.log('[resolveHero] Tier 5: Generating programmatic cover')
    
    let domain = 'carrot.app'
    try {
      if (input.url) {
        domain = new URL(input.url).hostname
      }
    } catch {
      console.warn('[resolveHero] Invalid URL, using default domain')
    }
    
    const generatedCover = await generateProgrammaticCover({
      domain,
      type: input.type,
      title: 'Content' // Could be passed from input if available
    })
    
    const result = await proxyDecorate(generatedCover, 'generated')
    return {
      ...result,
      license: 'generated' as HeroLicense
    }
  } catch (error) {
    console.error('[resolveHero] Tier 4 failed (should be impossible):', error)
    
    // ULTIMATE FALLBACK: Return a minimal valid response
    // This should NEVER happen, but guarantees 100% execution
    return {
      hero: `data:image/svg+xml,${encodeURIComponent(`
        <svg width="1280" height="720" xmlns="http://www.w3.org/2000/svg">
          <rect width="100%" height="100%" fill="#667eea"/>
          <text x="640" y="360" text-anchor="middle" font-size="24" fill="white" font-family="system-ui">
            Content
          </text>
        </svg>
      `)}`,
      source: 'generated' as HeroSource,
      license: 'generated' as HeroLicense
    }
  }
}
