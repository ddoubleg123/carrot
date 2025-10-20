import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { extractReadableContent, extractKeyPoints, extractTimeline, extractEntities } from '@/lib/readability'
import { sanitizeHtml, formatHtmlForDisplay } from '@/lib/sanitizeHtml'
import { fetchWithProxy } from '@/lib/fetchProxy'
import { canonicalizeUrl } from '@/lib/canonicalize'

interface ContentPreview {
  title: string
  meta: {
    sourceDomain: string
    author?: string
    publishDate?: string
    readingTime?: number
    favicon?: string
  }
  hero?: string
  summary: string
  keyPoints: string[]
  excerptHtml: string
  timeline: Array<{date: string, content: string}>
  entities: Array<{type: string, name: string, context?: string}>
  source: {
    domain: string
    favicon: string
    canonicalUrl: string
    author?: string
    publishDate?: string
    readingTime?: number
    lastVerified?: string
  }
  actions: {
    openOriginal: string
    copyLink: string
  }
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
    
    // Extract metadata from JSON field
    const metadata = content.metadata as any || {}
    const mediaAssets = content.mediaAssets as any || {}
    const contentData = content.content as any || {}
    
    // Build preview data
    const preview: ContentPreview = {
      title: content.title,
      meta: {
        sourceDomain: metadata.sourceDomain || 'unknown',
        author: metadata.author,
        publishDate: metadata.publishDate,
        readingTime: metadata.readingTime,
        favicon: `https://www.google.com/s2/favicons?domain=${metadata.sourceDomain || 'unknown'}&sz=16`
      },
      hero: mediaAssets.hero,
      summary: contentData.summary150 || '',
      keyPoints: contentData.keyPoints || [],
      excerptHtml: '',
      timeline: [],
      entities: [],
      source: {
        domain: metadata.sourceDomain || 'unknown',
        favicon: `https://www.google.com/s2/favicons?domain=${metadata.sourceDomain || 'unknown'}&sz=16`,
        canonicalUrl: content.url,
        author: metadata.author,
        publishDate: metadata.publishDate,
        readingTime: metadata.readingTime,
        lastVerified: new Date().toISOString()
      },
      actions: {
        openOriginal: content.url,
        copyLink: content.url
      }
    }
    
    // If we don't have enriched content, try to extract it
    if (!preview.summary || preview.keyPoints.length === 0) {
      try {
        console.log(`[ContentPreview] Extracting content for ${id}`)
        
        // Fetch the original content
        const response = await fetchWithProxy(content.url, {
          timeout: 10000,
          userAgent: 'Mozilla/5.0 (compatible; CarrotBot/1.0)'
        })
        
        if (response.ok) {
          const html = await response.text()
          const readable = extractReadableContent(html, content.url)
          
          // Update preview with extracted content
          if (!preview.summary && readable.excerpt) {
            preview.summary = readable.excerpt
          }
          
          if (preview.keyPoints.length === 0) {
            preview.keyPoints = extractKeyPoints(readable.textContent, 5)
          }
          
          // Extract timeline and entities
          preview.timeline = extractTimeline(readable.textContent)
          preview.entities = extractEntities(readable.textContent)
          
          // Create excerpt HTML
          if (readable.content) {
            preview.excerptHtml = formatHtmlForDisplay(readable.content)
          }
          
          // Update database with extracted content
          await prisma.discoveredContent.update({
            where: { id },
            data: {
              content: {
                ...content.content,
                summary150: preview.summary,
                keyPoints: preview.keyPoints
              },
              metadata: {
                ...content.metadata,
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
