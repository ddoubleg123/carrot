import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { extractReadableContent, extractKeyPoints, extractTimeline, extractEntities } from '@/lib/readability'
import { sanitizeHtml, formatHtmlForDisplay } from '@/lib/sanitizeHtml'
import { fetchWithProxy } from '@/lib/fetchProxy'
import { canonicalizeUrl } from '@/lib/canonicalize'
import { ContentPreview } from '@/types/content-preview'

// Simple in-memory cache (in production, use Redis)
const previewCache = new Map<string, ContentPreview>()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // Check cache first (but skip cache for now to ensure fixes are applied)
    // TODO: Re-enable cache after verifying fixes work
    const cacheKey = `content:preview:${id}`
    const cached = previewCache.get(cacheKey)
    // Temporarily disable cache to ensure fixes are applied
    // if (cached) {
    //   return NextResponse.json(cached)
    // }
    
    // Fetch content from database
    const content = await prisma.discoveredContent.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        summary: true,
        whyItMatters: true,
        facts: true,
        metadata: true,
        hero: true,
        sourceUrl: true,
        canonicalUrl: true,
        category: true,
        patch: {
          select: {
            title: true,
            handle: true,
            tags: true
          }
        }
      }
    })
    
    if (!content) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 })
    }
    
    // Extract metadata from JSON fields
    let metadata = (content.metadata as any) || {}
    const heroData = (content.hero as any) || {}
    const facts = Array.isArray(content.facts as any)
      ? (content.facts as any[])
      : []
    const baseSummary: string = metadata.summary150 || content.summary || content.whyItMatters || ''
    const baseKeyPoints: string[] = Array.isArray(metadata.keyPoints)
      ? metadata.keyPoints
      : facts
          .map((fact) => {
            if (typeof fact === 'string') return fact
            if (fact && typeof fact.value === 'string') return fact.value
            if (fact && typeof fact.text === 'string') return fact.text
            return null
          })
          .filter((value): value is string => Boolean(value))
          .slice(0, 6)
    
    // Build preview data
    const sourceDomain = metadata.sourceDomain || (() => {
      try {
        return new URL(content.sourceUrl || 'https://unknown.com').hostname.replace('www.', '')
      } catch {
        return 'unknown.com'
      }
    })()

    // Check if hero is directly from Wikipedia - if so, don't display it
    // Wikipedia pages should be used to find deep source links, not as direct sources
    let heroUrl = heroData?.url || null
    const sourceUrl = content.sourceUrl || ''
    const isWikipediaSource = sourceUrl.includes('wikipedia.org') || 
                              sourceUrl.includes('wikimedia.org') ||
                              sourceUrl.includes('wikidata.org')
    const isWikipediaHero = heroUrl && (
      heroUrl.includes('wikipedia.org') || 
      heroUrl.includes('wikimedia.org') ||
      heroUrl.includes('wikidata.org')
    )
    
    // If the source is Wikipedia OR the hero is from Wikipedia, don't display it
    // (but keep it in the database for reference)
    if (isWikipediaSource || isWikipediaHero) {
      console.log(`[ContentPreview] Filtering out Wikipedia hero for ${id} (source: ${isWikipediaSource}, hero: ${isWikipediaHero})`)
      heroUrl = null
    }

    // Improve title if it's generic
    function improveTitle(originalTitle: string, summary: string, keyPoints: string[]): string {
      const genericPhrases = [
        'official website',
        'official site',
        'home',
        'welcome',
        'about us',
        'contact',
        'news',
        'updates',
        'news and updates'
      ]
      
      const titleLower = originalTitle.toLowerCase().trim()
      const hasGenericPhrase = genericPhrases.some(phrase => titleLower === phrase || titleLower.includes(phrase))
      
      // If title is generic or too short, try to create a better one
      if (hasGenericPhrase || originalTitle.length < 10) {
        // Try to extract from summary first
        if (summary && summary.length > 20) {
          // Take first meaningful sentence or phrase from summary
          const firstSentence = summary.split(/[.!?]/)[0].trim()
          if (firstSentence.length > 15 && firstSentence.length < 100) {
            // Capitalize first letter
            const improved = firstSentence.charAt(0).toUpperCase() + firstSentence.slice(1)
            console.log(`[ContentPreview] Improved title from "${originalTitle}" to "${improved}" (from summary)`)
            return improved
          }
          
          // Fallback: extract meaningful words from summary
          const words = summary.split(' ').slice(0, 12)
          const meaningfulWords = words.filter((word: string) => 
            word.length > 2 && 
            !['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'a', 'an'].includes(word.toLowerCase())
          ).slice(0, 8)
          
          if (meaningfulWords.length >= 3) {
            const improved = meaningfulWords.map((word: string) => 
              word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
            ).join(' ')
            console.log(`[ContentPreview] Improved title from "${originalTitle}" to "${improved}" (from summary words)`)
            return improved
          }
        }
        
        // Try key points if summary didn't work
        if (keyPoints && keyPoints.length > 0) {
          const firstFact = keyPoints[0]
          if (firstFact && firstFact.length > 15 && firstFact.length < 100) {
            // Extract subject from first fact
            const improved = firstFact.charAt(0).toUpperCase() + firstFact.slice(1)
            console.log(`[ContentPreview] Improved title from "${originalTitle}" to "${improved}" (from key fact)`)
            return improved
          }
        }
      }
      
      // Clean up title (remove site name suffixes)
      const cleanTitle = originalTitle
        .replace(/\s*\|.*$/, '') // Remove " | Site Name" suffixes
        .replace(/\s*-\s*.*$/, '') // Remove " - Site Name" suffixes
        .replace(/\s*::.*$/, '') // Remove " :: Site Name" suffixes
        .trim()
      
      return cleanTitle || originalTitle || 'Untitled Content'
    }
    
    const improvedTitle = improveTitle(content.title, baseSummary, baseKeyPoints)
    
    // Update database title if it was improved
    if (improvedTitle !== content.title && improvedTitle.length > 10) {
      try {
        await prisma.discoveredContent.update({
          where: { id },
          data: { title: improvedTitle }
        })
        console.log(`[ContentPreview] Updated database title for ${id}`)
      } catch (error) {
        console.error(`[ContentPreview] Failed to update title:`, error)
        // Non-fatal - continue with improved title in preview
      }
    }

    // Helper function to truncate summary at sentence boundary (up to ~240 chars)
    function truncateSummaryAtSentence(text: string, maxLength: number = 240): string {
      if (text.length <= maxLength) return text
      
      // Find the last complete sentence before maxLength
      const truncated = text.substring(0, maxLength)
      const lastPeriod = truncated.lastIndexOf('.')
      const lastExclamation = truncated.lastIndexOf('!')
      const lastQuestion = truncated.lastIndexOf('?')
      const lastSentenceEnd = Math.max(lastPeriod, lastExclamation, lastQuestion)
      
      if (lastSentenceEnd > maxLength * 0.7) {
        // If we found a sentence end reasonably close to the limit, use it
        return text.substring(0, lastSentenceEnd + 1).trim()
      }
      
      // Otherwise, truncate at word boundary
      const lastSpace = truncated.lastIndexOf(' ')
      if (lastSpace > maxLength * 0.8) {
        return text.substring(0, lastSpace).trim()
      }
      
      return truncated.trim()
    }

    const preview: ContentPreview = {
      id: content.id,
      title: improvedTitle,
      summary: truncateSummaryAtSentence(baseSummary),
      keyPoints: baseKeyPoints,
      excerptHtml: '',
      entities: metadata.entities || [],
      timeline: metadata.timeline || [],
      media: {
        hero: heroUrl,
        dominant: heroData?.dominantColor || heroData?.dominant
      },
      source: {
        url: content.sourceUrl || '',
        domain: sourceDomain,
        favicon: `https://www.google.com/s2/favicons?domain=${sourceDomain}&sz=16`,
        title: content.title,
        verified: true // Will be updated after verification
      },
      meta: {
        author: metadata.author,
        publishDate: metadata.publishDate,
        readingTime: metadata.readingTimeMin || Math.ceil((baseSummary || '').length / 1000),
        domain: sourceDomain,
        url: content.sourceUrl || '',
        canonicalUrl: content.canonicalUrl || content.sourceUrl || ''
      }
    }
    
    // If we don't have enriched content, try to extract it
    if (!preview.summary || preview.keyPoints.length === 0) {
      try {
        console.log(`[ContentPreview] Extracting content for ${id}`)
        
        // Fetch the original content
        const response = await fetchWithProxy(content.sourceUrl || '', {
          timeout: 10000,
          userAgent: 'Mozilla/5.0 (compatible; CarrotBot/1.0)'
        })
        
        if (response.ok) {
          const html = await response.text()
          const readable = extractReadableContent(html, content.sourceUrl || '')
          
          // Update preview with extracted content
          if (!preview.summary && readable.excerpt) {
            preview.summary = truncateSummaryAtSentence(readable.excerpt)
          }
          
          if (preview.keyPoints.length === 0) {
            preview.keyPoints = extractKeyPoints(readable.textContent, 7)
              .filter(point => point.length <= 120)
              .slice(0, 7)
          }
          
          // Extract timeline and entities
          preview.timeline = extractTimeline(readable.textContent).slice(0, 10).map(item => ({
            date: item.date,
            fact: item.content
          }))
          preview.entities = extractEntities(readable.textContent)
            .filter((entity, index, self) => 
              self.findIndex(e => e.name === entity.name) === index
            )
            .slice(0, 20)
          
          // Create excerpt HTML (first 2-4 paragraphs, sanitized)
          if (readable.content) {
            const sanitized = sanitizeHtml(readable.content)
            preview.excerptHtml = formatHtmlForDisplay(sanitized)
          }
          
          // Update database with extracted content
          metadata = {
            ...metadata,
            extractedAt: new Date().toISOString(),
            summary150: preview.summary,
            keyPoints: preview.keyPoints,
            readingTimeMin: preview.meta.readingTime,
            timeline: preview.timeline,
            entities: preview.entities,
            rawText: readable.textContent
          }

          await prisma.discoveredContent.update({
            where: { id },
            data: {
              summary: preview.summary || content.summary || '',
              metadata: metadata as Prisma.JsonObject
            }
          })
          
          console.log(`[ContentPreview] Successfully extracted content for ${id}`)
        } else {
          console.warn(`[ContentPreview] Failed to fetch content for ${id}: ${response.status}`)
        }
      } catch (error) {
        console.error(`[ContentPreview] Error extracting content for ${id}:`, error)
        // Continue with existing data
      }
    }

    // Quality check: ensure minimum content requirements
    if (preview.summary.length < 120 || preview.keyPoints.length < 3) {
      console.log(`[ContentPreview] Quality gate failed for ${id} - re-running with DeepSeek`)
      
      try {
        // Import enrichment utilities
        const { enrichContentWithDeepSeek, enrichContentFallback } = await import('@/lib/summarize/enrichContent')
        
        // Get article text for enrichment
        let articleText = typeof metadata.rawText === 'string' ? metadata.rawText : ''
        
        // If we don't have good content, try to fetch it
        if (articleText.length < 500 && content.sourceUrl) {
          try {
            const fetchResponse = await fetchWithProxy(content.sourceUrl, { timeout: 8000 })
            if (fetchResponse.ok) {
              const html = await fetchResponse.text()
              const readable = extractReadableContent(html, content.sourceUrl)
              articleText = readable.textContent
              metadata.rawText = articleText
            }
          } catch (fetchError) {
            console.warn(`[ContentPreview] Could not fetch source for enrichment:`, fetchError)
          }
        }
        
        // Try DeepSeek enrichment with retry
        const patchTags = content.patch?.tags || []
        const enrichmentResult = await enrichContentWithDeepSeek(
          articleText,
          content.title,
          content.sourceUrl || '',
          patchTags
        )
        
        if (enrichmentResult.success && enrichmentResult.data) {
          console.log(`[ContentPreview] ✅ DeepSeek enrichment successful for ${id}`)
          preview.summary = enrichmentResult.data.summary
          preview.keyPoints = enrichmentResult.data.keyFacts.map(f => f.text)
          preview.context = enrichmentResult.data.context
          // Transform string entities to object format
          preview.entities = enrichmentResult.data.entities.map(name => ({
            name,
            type: 'unknown' // DeepSeek doesn't provide type classification
          }))
          
          // Update database with AI-enriched content
          metadata = {
            ...metadata,
            summary150: preview.summary,
            keyPoints: preview.keyPoints,
            context: preview.context,
            aiEnriched: true,
            enrichedAt: new Date().toISOString(),
            entities: preview.entities
          }

          await prisma.discoveredContent.update({
            where: { id },
            data: {
              summary: preview.summary,
              metadata: metadata as Prisma.JsonObject
            }
          })
        } else {
          console.warn(`[ContentPreview] ⚠️ DeepSeek enrichment failed for ${id}, using fallback`)
          console.warn(`[ContentPreview] Errors:`, enrichmentResult.errors)
          
          // Use fallback enrichment
          const fallbackData = enrichContentFallback(articleText, content.title)
          preview.summary = fallbackData.summary
          preview.keyPoints = fallbackData.keyFacts.map(f => f.text)
          preview.context = fallbackData.context
        }
      } catch (enrichError) {
        console.error(`[ContentPreview] Error during enrichment for ${id}:`, enrichError)
        
        // Last resort fallback
        if (preview.summary.length < 120) {
          preview.summary = truncateSummaryAtSentence(baseSummary)
        }
        
        if (preview.keyPoints.length < 3) {
          const contentText = typeof metadata.rawText === 'string' ? metadata.rawText : baseSummary
          const sentences = contentText.split(/[.!?]+/)
            .map((s: string) => s.trim())
            .filter((s: string) => s.length > 20 && s.length < 120)
            .slice(0, 7)
          
          preview.keyPoints = sentences.slice(0, 7)
        }
      }
    }

    // Always run grammar/language cleanup on summary and key facts
    // Run BEFORE caching to ensure cleaned content is cached
    if (preview.summary || (preview.keyPoints && preview.keyPoints.length > 0)) {
      try {
        console.log(`[ContentPreview] Running grammar cleanup for ${id}`)
        
        // Use request URL to build cleanup endpoint URL (works in both dev and production)
        const requestUrl = new URL(request.url)
        const baseUrl = `${requestUrl.protocol}//${requestUrl.host}`
        const cleanupUrl = `${baseUrl}/api/ai/cleanup-content`
        
        console.log(`[ContentPreview] Cleanup URL: ${cleanupUrl}`)
        
        const cleanupResponse = await fetch(cleanupUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            summary: preview.summary,
            keyFacts: preview.keyPoints,
            title: content.title
          }),
          // Add timeout to prevent hanging
          signal: AbortSignal.timeout(15000) // 15 second timeout
        })

        if (cleanupResponse.ok) {
          const cleanupData = await cleanupResponse.json()
          
          let shouldUpdate = false
          
          if (cleanupData.summary && cleanupData.summary.length > 0) {
            console.log(`[ContentPreview] Summary cleaned: ${preview.summary.substring(0, 50)}... → ${cleanupData.summary.substring(0, 50)}...`)
            preview.summary = cleanupData.summary
            shouldUpdate = true
          }
          
          if (cleanupData.keyFacts && Array.isArray(cleanupData.keyFacts) && cleanupData.keyFacts.length > 0) {
            console.log(`[ContentPreview] Key facts cleaned: ${preview.keyPoints.length} → ${cleanupData.keyFacts.length}`)
            preview.keyPoints = cleanupData.keyFacts
            shouldUpdate = true
          }
          
          // Persist cleaned content to database
          if (shouldUpdate) {
            try {
              const currentMetadata = (content.metadata as any) || {}
              const updatedMetadata = {
                ...currentMetadata,
                grammarCleaned: true,
                grammarCleanedAt: new Date().toISOString(),
                summary150: preview.summary,
                keyPoints: preview.keyPoints
              }

              await prisma.discoveredContent.update({
                where: { id },
                data: {
                  summary: preview.summary,
                  facts: preview.keyPoints.map((fact: string) => ({
                    label: 'Fact',
                    value: fact
                  })),
                  metadata: updatedMetadata as Prisma.JsonObject
                }
              })

              console.log(`[ContentPreview] 💾 Persisted cleaned content to database`)
            } catch (updateError: any) {
              console.warn(`[ContentPreview] Failed to persist cleaned content:`, updateError.message)
            }
          }
          
          console.log(`[ContentPreview] ✅ Grammar cleanup successful for ${id}`)
          if (cleanupData.improvements && cleanupData.improvements.length > 0) {
            console.log(`[ContentPreview] Improvements:`, cleanupData.improvements)
          }
        } else {
          const errorText = await cleanupResponse.text()
          console.warn(`[ContentPreview] Grammar cleanup failed for ${id}: ${cleanupResponse.status} - ${errorText.substring(0, 200)}`)
        }
      } catch (cleanupError: any) {
        console.warn(`[ContentPreview] Error during grammar cleanup for ${id}:`, cleanupError.message)
        // Continue with original content if cleanup fails
      }
    }

    // Verify link status
    try {
      const verifyResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/internal/links/verify?url=${encodeURIComponent(preview.source.url)}`)
      if (verifyResponse.ok) {
        const verifyData = await verifyResponse.json()
        preview.source.verified = verifyData.ok
      }
    } catch (error) {
      console.warn(`[ContentPreview] Link verification failed for ${id}:`, error)
    }
    
    // Cache the result for 6 hours
    previewCache.set(cacheKey, preview)
    
    return NextResponse.json(preview)
    
  } catch (error) {
    console.error('[ContentPreview] Error:', error)
    return NextResponse.json(
      { error: 'Failed to generate preview' },
      { status: 500 }
    )
  }
}