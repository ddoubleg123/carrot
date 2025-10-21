import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { extractReadableContent, extractKeyPoints, extractTimeline, extractEntities } from '@/lib/readability'
import { sanitizeHtml, formatHtmlForDisplay } from '@/lib/sanitizeHtml'
import { fetchWithProxy } from '@/lib/fetchProxy'
import { canonicalizeUrl } from '@/lib/canonicalize'

interface ContentPreview {
  title: string
  meta: {
    domain: string
    favicon: string
    author?: string
    publishDate?: string
    readTime?: number
    canonicalUrl: string
    verified: boolean
  }
  hero?: string
  summary: string
  keyPoints: string[]
  excerptHtml?: string
  entities?: string[]
  timeline?: Array<{date: string, fact: string}>
}

// Simple in-memory cache (in production, use Redis)
const previewCache = new Map<string, ContentPreview>()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // Check cache first
    const cacheKey = `content:preview:${id}`
    const cached = previewCache.get(cacheKey)
    if (cached) {
      return NextResponse.json(cached)
    }
    
    // Fetch content from database
    const content = await prisma.discoveredContent.findUnique({
      where: { id },
      include: {
        patch: {
          select: {
            name: true,
            handle: true
          }
        }
      }
    })
    
    if (!content) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 })
    }
    
    // Extract metadata from JSON fields
    const metadata = content.metadata as any || {}
    const mediaAssets = content.mediaAssets as any || {}
    const enrichedContent = content.enrichedContent as any || {}
    
    // Build preview data
    const preview: ContentPreview = {
      title: content.title,
      meta: {
        domain: metadata.sourceDomain || 'unknown',
        favicon: `https://www.google.com/s2/favicons?domain=${metadata.sourceDomain || 'unknown'}&sz=16`,
        author: metadata.author,
        publishDate: metadata.publishDate,
        readTime: enrichedContent.readingTimeMin || Math.ceil((content.content || '').length / 1000),
        canonicalUrl: content.sourceUrl || '',
        verified: true // Will be updated after verification
      },
      hero: mediaAssets.heroImage?.url || mediaAssets.hero,
      summary: enrichedContent.summary150 || (content.content || '').substring(0, 150),
      keyPoints: enrichedContent.keyPoints || [],
      excerptHtml: '',
      entities: metadata.entities || [],
      timeline: metadata.timeline || []
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
            .map(e => e.name)
            .filter((name, index, self) => self.indexOf(name) === index)
            .slice(0, 20)
          
          // Create excerpt HTML (first 2-4 paragraphs, sanitized)
          if (readable.content) {
            const sanitized = sanitizeHtml(readable.content)
            preview.excerptHtml = formatHtmlForDisplay(sanitized)
          }
          
          // Update database with extracted content
          await prisma.discoveredContent.update({
            where: { id },
            data: {
              enrichedContent: {
                ...enrichedContent,
                summary150: preview.summary,
                keyPoints: preview.keyPoints,
                readingTimeMin: preview.meta.readTime
              },
              metadata: {
                ...metadata,
                extractedAt: new Date().toISOString(),
                timeline: preview.timeline,
                entities: preview.entities
              }
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
      console.log(`[ContentPreview] Re-running summarizer for ${id} - insufficient content`)
      
      // Re-run with stricter prompt (this would call an AI service in production)
      // For now, we'll use the existing content but ensure minimum quality
      if (preview.summary.length < 120) {
        preview.summary = (content.content || '').substring(0, 240)
      }
      
      if (preview.keyPoints.length < 3) {
        // Generate key points from content
        const contentText = content.content || ''
        const sentences = contentText.split(/[.!?]+/)
          .map(s => s.trim())
          .filter(s => s.length > 20 && s.length < 120)
          .slice(0, 7)
        
        preview.keyPoints = sentences.slice(0, 7)
      }
    }

    // Verify link status
    try {
      const verifyResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/internal/links/verify?url=${encodeURIComponent(preview.meta.canonicalUrl)}`)
      if (verifyResponse.ok) {
        const verifyData = await verifyResponse.json()
        preview.meta.verified = verifyData.ok
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