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

    const preview: ContentPreview = {
      id: content.id,
      title: content.title,
      summary: baseSummary.substring(0, 240),
      keyPoints: baseKeyPoints,
      excerptHtml: '',
      entities: metadata.entities || [],
      timeline: metadata.timeline || [],
      media: {
        hero: heroData?.url,
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
        readingTime: metadata.readingTimeMin || Math.ceil((baseSummary || '').length / 1000)
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
            preview.summary = readable.excerpt.substring(0, 240)
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
          preview.summary = baseSummary.substring(0, 240)
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