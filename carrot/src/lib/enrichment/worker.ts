/**
 * Hero enrichment worker
 * Fetches deep links, extracts content, generates quotes/summaries, and creates Hero records
 */

import { prisma } from '@/lib/prisma'
import { createResilientFetch } from '@/lib/retryUtils'
import { JSDOM } from 'jsdom'
import { v4 as uuidv4 } from 'uuid'
import { clampFairUseToHtml } from '@/lib/fairUse'
import { sanitizeLogEntry } from '@/lib/logging/redact'

// Note: @mozilla/readability is not installed - we use DOM fallback only
// The extractContent function uses DOM heuristics for content extraction

export interface EnrichmentResult {
  ok: boolean
  heroId?: string
  traceId: string
  phase: 'fetch' | 'extract' | 'summarize' | 'quote' | 'image' | 'upsert'
  errorCode?: string
  errorMessage?: string
  durationMs: number
}

interface ExtractedContent {
  title: string
  author?: string
  publishDate?: Date
  mainText: string
  paragraphs: string[]
  canonicalUrl?: string
}

const FETCH_TIMEOUT_MS = 30000 // 30s - increased for slow sites

/**
 * Structured logging helper with PII redaction
 */
function log(phase: string, meta: Record<string, any>) {
  const logEntry = {
    ts: Date.now(),
    stage: phase as 'search' | 'save' | 'enrich' | 'hero' | 'image' | 'fe',
    status: meta.ok === false ? 'error' : meta.ok === true ? 'ok' : 'warn',
    ...meta
  }
  // Sanitize log entry before output (redacts sensitive data)
  const sanitized = sanitizeLogEntry(logEntry)
  console.log(JSON.stringify(sanitized))
}

/**
 * Fetch deep link HTML with timeout and retry
 */
async function fetchDeepLink(url: string, traceId: string): Promise<{ html: string; finalUrl: string }> {
  const startTime = Date.now()
  log('fetch', { traceId, url: url.substring(0, 100), phase: 'start' })

  // Normalize URL before fetching
  const { normalizeUrlWithWWW } = await import('@/lib/utils/urlNormalization')
  const normalizedUrl = normalizeUrlWithWWW(url)

  // Create AbortController for timeout (declare outside try for catch access)
  const controller = new AbortController()
  let timeoutId: NodeJS.Timeout | null = null

  try {
    // Create resilient fetch (no arguments)
    const resilientFetch = createResilientFetch()
    
    // Set timeout
    timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    // Use proper UA string identifying crawler with domain + contact
    const userAgent = process.env.CRAWLER_USER_AGENT || 
      `CarrotCrawler/1.0 (+https://carrot-app.onrender.com; contact@carrot.app)`
    
    const response = await resilientFetch(normalizedUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    })
    
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }

    const durationMs = Date.now() - startTime

    if (!response.ok) {
      const errorCode = response.status >= 400 && response.status < 500 ? 'HTTP_4XX' : 'HTTP_5XX'
      log('fetch', { traceId, url: normalizedUrl, ok: false, httpStatus: response.status, durationMs, errorCode })
      throw new Error(`HTTP ${response.status}`)
    }

    const html = await response.text()
    const finalUrl = response.url || normalizedUrl

    log('fetch', { traceId, url: normalizedUrl, ok: true, httpStatus: response.status, durationMs, bytes: html.length })
    return { html, finalUrl }
  } catch (error: any) {
    if (timeoutId) {
      clearTimeout(timeoutId) // Clean up timeout if still pending
    }
    const durationMs = Date.now() - startTime
    const errorCode = error.name === 'AbortError' || error.message?.includes('timeout') || error.message?.includes('aborted') ? 'TIMEOUT' : 
                     error.message?.includes('401') || error.message?.includes('403') ? 'PAYWALL' :
                     error.message?.includes('404') ? 'HTTP_4XX' : 'FETCH_ERROR'
    
    log('fetch', { traceId, url: normalizedUrl, ok: false, durationMs, errorCode, errorMessage: error.message?.substring(0, 200) })
    throw error
  }
}

/**
 * Extract content using Mozilla Readability with fallback
 */
function extractContent(html: string, url: string, traceId: string): ExtractedContent {
  const startTime = Date.now()
  log('extract', { traceId, url: url.substring(0, 100), phase: 'start' })

  try {
    const dom = new JSDOM(html, { url })
    const doc = dom.window.document
    
    // Extract title
    const title = doc.querySelector('title')?.textContent || 
                 doc.querySelector('h1')?.textContent || 
                 doc.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
                 'Untitled'
    
    // Try to find main content
    const mainContent = doc.querySelector('article') || 
                       doc.querySelector('main') ||
                       doc.querySelector('[role="main"]') ||
                       doc.querySelector('.content') ||
                       doc.body

    const textContent = mainContent.textContent || ''
    const article = {
      title,
      textContent
    }

    // Extract paragraphs
    const paragraphs = textContent
      .split(/\n\s*\n/)
      .map(p => p.trim())
      .filter(p => p.length > 50) // Filter out very short paragraphs

    // Get canonical URL from meta tags
    let canonicalUrl = url
    const canonicalLink = doc.querySelector('link[rel="canonical"]')
    if (canonicalLink) {
      const href = canonicalLink.getAttribute('href')
      if (href) {
        try {
          canonicalUrl = new URL(href, url).href
        } catch {
          // Invalid URL, use original
        }
      }
    }

    // Try to get publish date from meta tags
    let publishDate: Date | undefined
    const pubDateMeta = doc.querySelector('meta[property="article:published_time"]') ||
                       doc.querySelector('meta[name="publish-date"]')
    if (pubDateMeta) {
      const dateStr = pubDateMeta.getAttribute('content')
      if (dateStr) {
        publishDate = new Date(dateStr)
        if (isNaN(publishDate.getTime())) {
          publishDate = undefined
        }
      }
    }

    // Try to get author
    let author: string | undefined
    const authorMeta = doc.querySelector('meta[property="article:author"]') ||
                     doc.querySelector('meta[name="author"]')
    if (authorMeta) {
      author = authorMeta.getAttribute('content') || undefined
    }

    const durationMs = Date.now() - startTime
    log('extract', { traceId, ok: true, durationMs, titleLength: article.title?.length || 0, textLength: textContent.length })

    return {
      title: article.title || 'Untitled',
      author,
      publishDate,
      mainText: textContent,
      paragraphs,
      canonicalUrl
    }
  } catch (error: any) {
    const durationMs = Date.now() - startTime
    log('extract', { traceId, ok: false, durationMs, errorCode: 'PARSE_FAILURE', errorMessage: error.message?.substring(0, 200) })
    throw error
  }
}

/**
 * Generate quote (≤2 paragraphs, ≤1200 chars) from extracted content
 * Uses centralized fairUse clamp
 */
function generateQuote(paragraphs: string[], traceId: string): { quoteHtml: string; quoteCharCount: number } {
  const startTime = Date.now()
  log('quote', { traceId, phase: 'start', paragraphCount: paragraphs.length })

  // Use centralized fair-use clamp
  const quoteHtml = clampFairUseToHtml('', paragraphs)
  const quoteText = quoteHtml.replace(/<p>/g, '').replace(/<\/p>/g, '\n\n').trim()
  const quoteCharCount = quoteText.length

  const durationMs = Date.now() - startTime
  log('quote', { traceId, ok: true, durationMs, quoteCharCount, paragraphCount: Math.min(paragraphs.length, 2) })

  return { quoteHtml, quoteCharCount }
}

/**
 * Generate paraphrased summary (no quotes)
 */
function generateSummary(mainText: string, title: string, traceId: string): string {
  const startTime = Date.now()
  log('summarize', { traceId, phase: 'start', textLength: mainText.length })

  // Simple extractive summary: take first 2-3 sentences
  const sentences = mainText.match(/[^.!?]+[.!?]+/g) || []
  const summary = sentences.slice(0, 3).join(' ').trim()

  // If too short, add more context
  let finalSummary = summary
  if (finalSummary.length < 100) {
    finalSummary = sentences.slice(0, 5).join(' ').trim()
  }

  // Cap at 240 chars
  if (finalSummary.length > 240) {
    finalSummary = finalSummary.substring(0, 237) + '...'
  }

  const durationMs = Date.now() - startTime
  log('summarize', { traceId, ok: true, durationMs, summaryLength: finalSummary.length })

  return finalSummary || title // Fallback to title if no summary
}

/**
 * Attempt to get image from OpenGraph or article lead image
 */
async function getImageUrl(html: string, url: string, traceId: string): Promise<string | null> {
  const startTime = Date.now()
  log('image', { traceId, phase: 'start' })

  try {
    const dom = new JSDOM(html, { url })
    const doc = dom.window.document

    // Try OpenGraph image first
    const ogImage = doc.querySelector('meta[property="og:image"]')
    if (ogImage) {
      const imageUrl = ogImage.getAttribute('content')
      if (imageUrl) {
        try {
          const fullUrl = new URL(imageUrl, url).href
          const durationMs = Date.now() - startTime
          log('image', { traceId, ok: true, durationMs, source: 'og:image' })
          return fullUrl
        } catch {
          // Invalid URL
        }
      }
    }

    // Try article lead image
    const articleImage = doc.querySelector('article img, .article img, [role="article"] img')
    if (articleImage) {
      const imageUrl = articleImage.getAttribute('src')
      if (imageUrl) {
        try {
          const fullUrl = new URL(imageUrl, url).href
          const durationMs = Date.now() - startTime
          log('image', { traceId, ok: true, durationMs, source: 'inline' })
          return fullUrl
        } catch {
          // Invalid URL
        }
      }
    }

    // No image found - this is OK, hero can exist without image
    const durationMs = Date.now() - startTime
    log('image', { traceId, ok: true, durationMs, source: 'none', note: 'No image found, continuing without image' })
    return null
  } catch (error: any) {
    const durationMs = Date.now() - startTime
    log('image', { traceId, ok: false, durationMs, errorCode: 'IMAGE_EXTRACT_FAILURE', errorMessage: error.message?.substring(0, 200) })
    return null // Don't fail hero creation if image extraction fails
  }
}

/**
 * Main enrichment function
 */
export async function enrichContentId(contentId: string): Promise<EnrichmentResult> {
  const traceId = uuidv4()
  const overallStartTime = Date.now()

  try {
    // Get content
    const content = await prisma.discoveredContent.findUnique({
      where: { id: contentId },
      select: {
        id: true,
        title: true,
        sourceUrl: true,
        canonicalUrl: true,
        textContent: true,
        rawHtml: true
      }
    })

    if (!content) {
      return {
        ok: false,
        traceId,
        phase: 'fetch',
        errorCode: 'CONTENT_NOT_FOUND',
        errorMessage: 'Content not found',
        durationMs: Date.now() - overallStartTime
      }
    }

    const sourceUrl = content.canonicalUrl || content.sourceUrl
    if (!sourceUrl) {
      return {
        ok: false,
        traceId,
        phase: 'fetch',
        errorCode: 'NO_SOURCE_URL',
        errorMessage: 'No source URL available',
        durationMs: Date.now() - overallStartTime
      }
    }

    // Fetch HTML (or use cached rawHtml if available)
    let html: string
    let finalUrl: string = sourceUrl

    if (content.rawHtml) {
      // Use cached HTML
      html = Buffer.from(content.rawHtml).toString('utf-8')
      log('fetch', { traceId, url: sourceUrl, ok: true, httpStatus: 200, durationMs: 0, bytes: html.length, source: 'cached' })
    } else {
      // Fetch fresh
      const fetchResult = await fetchDeepLink(sourceUrl, traceId)
      html = fetchResult.html
      finalUrl = fetchResult.finalUrl
    }

    // Extract content
    const extracted = extractContent(html, finalUrl, traceId)

    // Generate quote
    const { quoteHtml, quoteCharCount } = generateQuote(extracted.paragraphs, traceId)

    // Generate summary
    const excerpt = generateSummary(extracted.mainText, extracted.title, traceId)

    // Attempt image with resilient fallback chain (never fails)
    let imageUrl: string | null = null
    let imageSource: 'og' | 'article' | 'wikipedia' | 'favicon' | 'ai' | 'placeholder' = 'placeholder'
    try {
      const { pickImageFallback } = await import('./imageFallback')
      const { normalizeUrlWithWWW } = await import('@/lib/utils/urlNormalization')
      // Normalize URL before fetching images
      const normalizedUrl = normalizeUrlWithWWW(finalUrl)
      const domain = extracted.canonicalUrl ? new URL(extracted.canonicalUrl).hostname : undefined
      const imageResult = await pickImageFallback({
        url: normalizedUrl,
        domain: domain || undefined,
        title: extracted.title,
        html
      })
      imageUrl = imageResult.url
      imageSource = imageResult.source
      log('image', { traceId, ok: true, source: imageResult.source, url: imageUrl.substring(0, 100) })
    } catch (error: any) {
      // Fallback to simple extraction if pickImageFallback fails
      imageUrl = await getImageUrl(html, finalUrl, traceId).catch(() => null)
      if (imageUrl) {
        imageSource = 'og'
      } else {
        // Try AI-generated hero image as fallback
        try {
          log('image', { traceId, phase: 'ai_fallback', note: 'Attempting AI generation' })
          const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://carrot-app.onrender.com'
          const aiResponse = await fetch(`${baseUrl}/api/ai/generate-hero-image`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-internal-key': process.env.INTERNAL_API_KEY || ''
            },
            body: JSON.stringify({
              title: extracted.title,
              description: excerpt.substring(0, 200),
              topic: 'research',
              style: 'editorial'
            }),
            signal: AbortSignal.timeout(15000) // 15s timeout for AI generation
          })
          
          if (aiResponse.ok) {
            const aiResult = await aiResponse.json()
            if (aiResult.success && aiResult.imageUrl) {
              imageUrl = aiResult.imageUrl
              imageSource = 'ai'
              log('image', { traceId, ok: true, source: 'ai', url: imageUrl?.substring(0, 100) || 'unknown' })
            }
          }
        } catch (aiError: any) {
          log('image', { traceId, ok: false, source: 'ai', errorCode: 'AI_GENERATION_FAILED', errorMessage: aiError.message?.substring(0, 200) })
        }
        
      }
    }

    // Ensure we always have an imageUrl (use favicon as absolute last resort)
    if (!imageUrl) {
      try {
        const domain = extracted.canonicalUrl ? new URL(extracted.canonicalUrl).hostname : 'example.com'
        imageUrl = `https://www.google.com/s2/favicons?sz=128&domain=${encodeURIComponent(domain)}`
        imageSource = 'favicon'
        log('image', { traceId, ok: true, source: 'favicon', note: 'Using favicon as absolute fallback' })
      } catch {
        // If even favicon fails, use a placeholder
        imageUrl = `https://via.placeholder.com/800x400/667eea/ffffff?text=${encodeURIComponent(extracted.title.substring(0, 30))}`
        imageSource = 'placeholder'
        log('image', { traceId, ok: true, source: 'placeholder', note: 'Using placeholder as last resort' })
      }
    }

    // Upsert Hero - always with imageUrl (never null)
    const upsertStartTime = Date.now()
    log('upsert', { traceId, phase: 'start' })

    const hero = await prisma.hero.upsert({
      where: { contentId },
      update: {
        title: extracted.title,
        excerpt,
        quoteHtml,
        quoteCharCount,
        imageUrl: imageUrl, // Always set (never null)
        sourceUrl: finalUrl,
        status: 'READY',
        updatedAt: new Date()
      },
      create: {
        contentId,
        title: extracted.title,
        excerpt,
        quoteHtml,
        quoteCharCount,
        imageUrl: imageUrl, // Always set (never null)
        sourceUrl: finalUrl,
        status: 'READY',
        traceId
      }
    })

    const upsertDurationMs = Date.now() - upsertStartTime
    log('upsert', { traceId, ok: true, durationMs: upsertDurationMs, heroId: hero.id })

    // Also update DiscoveredContent.hero JSON field for API compatibility
    try {
      await prisma.discoveredContent.update({
        where: { id: contentId },
        data: {
          hero: {
            url: imageUrl,
            source: imageSource,
            license: imageSource === 'ai' ? 'generated' : 'source',
            updatedAt: new Date().toISOString()
          } as any
        }
      })
      log('upsert', { traceId, ok: true, note: 'Updated DiscoveredContent.hero JSON field' })
    } catch (updateError) {
      // Non-critical - Hero table is primary source
      log('upsert', { traceId, ok: false, note: 'Failed to update DiscoveredContent.hero JSON', errorMessage: updateError instanceof Error ? updateError.message : 'Unknown' })
    }

    return {
      ok: true,
      heroId: hero.id,
      traceId,
      phase: 'upsert',
      durationMs: Date.now() - overallStartTime
    }

  } catch (error: any) {
    const durationMs = Date.now() - overallStartTime
    const errorCode = error.message?.includes('401') || error.message?.includes('403') ? 'PAYWALL' :
                     error.message?.includes('404') ? 'HTTP_4XX' :
                     error.message?.includes('timeout') ? 'TIMEOUT' :
                     error.message?.includes('parse') ? 'PARSE_FAILURE' : 'UNKNOWN_ERROR'

    // Still create hero record with ERROR status for retry capability
    // But ensure it has an imageUrl (use AI fallback or favicon)
    try {
      const content = await prisma.discoveredContent.findUnique({
        where: { id: contentId },
        select: { id: true, title: true, sourceUrl: true, canonicalUrl: true }
      })

      if (content) {
        const sourceUrl = content.canonicalUrl || content.sourceUrl || ''
        
        // Try to generate AI hero image as fallback even on error
        let fallbackImageUrl: string | null = null
        try {
          const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://carrot-app.onrender.com'
          const aiResponse = await fetch(`${baseUrl}/api/ai/generate-hero-image`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-internal-key': process.env.INTERNAL_API_KEY || ''
            },
            body: JSON.stringify({
              title: content.title,
              description: content.title.substring(0, 200),
              topic: 'research',
              style: 'editorial'
            }),
            signal: AbortSignal.timeout(10000) // 10s timeout for error recovery
          })
          
          if (aiResponse.ok) {
            const aiResult = await aiResponse.json()
            if (aiResult.success && aiResult.imageUrl) {
              fallbackImageUrl = aiResult.imageUrl
            }
          }
        } catch (aiError) {
          // AI generation failed, will use favicon
        }
        
        // Use favicon if AI generation failed
        if (!fallbackImageUrl) {
          try {
            const domain = sourceUrl ? new URL(sourceUrl).hostname : 'example.com'
            fallbackImageUrl = `https://www.google.com/s2/favicons?sz=128&domain=${encodeURIComponent(domain)}`
          } catch {
            fallbackImageUrl = `https://via.placeholder.com/800x400/667eea/ffffff?text=${encodeURIComponent(content.title.substring(0, 30))}`
          }
        }
        
        await prisma.hero.upsert({
          where: { contentId },
          update: {
            title: content.title,
            imageUrl: fallbackImageUrl, // Always set (never null)
            sourceUrl, // Required field
            status: 'ERROR',
            errorCode,
            errorMessage: error.message?.substring(0, 500) || 'Unknown error',
            traceId,
            updatedAt: new Date()
          },
          create: {
            contentId,
            title: content.title,
            imageUrl: fallbackImageUrl, // Always set (never null)
            sourceUrl, // Required field
            status: 'ERROR',
            errorCode,
            errorMessage: error.message?.substring(0, 500) || 'Unknown error',
            traceId
          }
        })
      }
    } catch (upsertError) {
      log('upsert', { traceId, ok: false, durationMs: 0, errorCode: 'DB_WRITE_ERROR', errorMessage: upsertError instanceof Error ? upsertError.message : 'Unknown' })
    }

    log('enrich', { traceId, ok: false, durationMs, errorCode, errorMessage: error.message?.substring(0, 200) })

    return {
      ok: false,
      traceId,
      phase: 'upsert',
      errorCode,
      errorMessage: error.message?.substring(0, 500),
      durationMs
    }
  }
}

