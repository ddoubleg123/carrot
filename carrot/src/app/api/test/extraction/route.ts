/**
 * API route to show all extracted URLs AND stored data from database
 * GET /api/test/extraction
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { extractAllExternalUrls } from '@/lib/discovery/wikiUtils'

export async function GET() {
  try {
    // Get Israel patch
    const patch = await prisma.patch.findUnique({
      where: { handle: 'israel' },
      select: { id: true, title: true }
    })

    if (!patch) {
      return NextResponse.json({ error: 'Israel patch not found' }, { status: 404 })
    }

    // Fetch the Apartheid Wikipedia page for extraction test
    // Use Promise.race with timeout to prevent hanging
    let html: string
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout after 20 seconds')), 20000)
      })
      
      const fetchPromise = fetch('https://en.wikipedia.org/wiki/Apartheid', {
        headers: {
          'User-Agent': 'CarrotBot/1.0 (https://carrot-app.onrender.com)'
        }
      })
      
      const response = await Promise.race([fetchPromise, timeoutPromise])

      if (!response.ok) {
        return NextResponse.json(
          { error: `Failed to fetch Wikipedia page: ${response.status}` },
          { status: response.status }
        )
      }

      html = await response.text()
    } catch (fetchError: any) {
      console.error('[Test Extraction] Fetch error:', fetchError)
      // Return a more helpful error message
      const errorMessage = fetchError.message?.includes('timeout') 
        ? 'Wikipedia fetch timed out after 20 seconds'
        : fetchError.message || 'Network error'
      return NextResponse.json(
        { error: `Failed to fetch Wikipedia page: ${errorMessage}` },
        { status: 500 }
      )
    }
    
    // Extract URLs (for comparison)
    let extractedUrls: any[]
    try {
      extractedUrls = extractAllExternalUrls(html, 'https://en.wikipedia.org/wiki/Apartheid')
    } catch (extractError: any) {
      console.error('[Test Extraction] Extraction error:', extractError)
      return NextResponse.json(
        { error: `Failed to extract URLs: ${extractError.message || 'Unknown error'}` },
        { status: 500 }
      )
    }
    
    // Get ALL stored citations from database for Israel patch
    // Include both external URLs AND Wikipedia internal links
    let allStoredCitations: any[]
    try {
      allStoredCitations = await prisma.wikipediaCitation.findMany({
        where: {
          monitoring: { patchId: patch.id }
          // Include ALL citations (external + Wikipedia internal)
        },
        include: {
          monitoring: {
            select: {
              wikipediaTitle: true,
              wikipediaUrl: true
            }
          }
        },
        orderBy: [
          { aiPriorityScore: 'desc' },
          { createdAt: 'asc' }
        ],
        // No limit - get ALL external URLs
      })
    } catch (dbError: any) {
      console.error('[Test Extraction] Database error (citations):', dbError)
      return NextResponse.json(
        { error: `Database error: ${dbError.message || 'Unknown error'}` },
        { status: 500 }
      )
    }

    // All citations are external (filtered above)
    const externalCitations = allStoredCitations
    const storedCitations = externalCitations

    // Get stored DiscoveredContent
    let storedContent: any[]
    try {
      storedContent = await prisma.discoveredContent.findMany({
        where: {
          patchId: patch.id
        },
        select: {
          id: true,
          title: true,
          canonicalUrl: true,
          sourceUrl: true,
          relevanceScore: true,
          qualityScore: true,
          summary: true,
          content: true,
          createdAt: true
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 100
      })
    } catch (dbError: any) {
      console.error('[Test Extraction] Database error (content):', dbError)
      storedContent = [] // Continue with empty array
    }

    // Get stored AgentMemories
    let storedMemories: any[]
    try {
      storedMemories = await prisma.agentMemory.findMany({
        where: {
          sourceUrl: { contains: 'hrw.org' }
        },
        select: {
          id: true,
          sourceTitle: true,
          sourceUrl: true,
          content: true,
          createdAt: true
        },
        take: 50
      })
    } catch (dbError: any) {
      console.error('[Test Extraction] Database error (memories):', dbError)
      storedMemories = [] // Continue with empty array
    }

    // Separate extracted URLs by type
    const wikipediaUrls = extractedUrls.filter(c => c.url.includes('wikipedia.org'))
    const externalUrls = extractedUrls.filter(c => !c.url.includes('wikipedia.org'))
    
    // Group by section
    const bySection = extractedUrls.reduce((acc, cit) => {
      const section = cit.context || 'Unknown'
      if (!acc[section]) acc[section] = []
      acc[section].push(cit)
      return acc
    }, {} as Record<string, typeof extractedUrls>)

    // Statistics
    const stats = {
      extracted: {
        total: extractedUrls.length,
        wikipedia: wikipediaUrls.length,
        external: externalUrls.length
      },
      stored: {
        citations: storedCitations.length,
        scanned: storedCitations.filter(c => c.scanStatus === 'scanned').length,
        pending: storedCitations.filter(c => c.scanStatus === 'not_scanned').length,
        saved: storedCitations.filter(c => c.savedContentId !== null).length,
        denied: storedCitations.filter(c => c.relevanceDecision === 'denied').length,
        withContent: storedCitations.filter(c => c.contentText && c.contentText.length > 0).length,
        withScores: storedCitations.filter(c => c.aiPriorityScore !== null).length
      },
      discoveredContent: storedContent.length,
      agentMemories: storedMemories.length
    }

    return NextResponse.json({
      success: true,
      stats,
      extracted: {
        urls: extractedUrls,
        bySection,
        extractedAt: new Date().toISOString()
      },
      stored: {
        citations: storedCitations.map(c => ({
          id: c.id,
          url: c.citationUrl,
          title: c.citationTitle,
          context: c.citationContext,
          sourceNumber: c.sourceNumber, // Reference number on Wikipedia page
          contentText: c.contentText ? c.contentText.substring(0, 1000) + (c.contentText.length > 1000 ? '...' : '') : null,
          contentLength: c.contentText?.length || 0,
          aiScore: c.aiPriorityScore,
          scanStatus: c.scanStatus,
          relevanceDecision: c.relevanceDecision,
          verificationStatus: c.verificationStatus,
          savedContentId: c.savedContentId,
          savedMemoryId: c.savedMemoryId,
          errorMessage: c.errorMessage,
          fromWikipediaPage: c.monitoring?.wikipediaTitle || 'Unknown',
          fromWikipediaUrl: c.monitoring?.wikipediaUrl || null,
          referenceNumber: c.sourceNumber, // Clear alias
          lastScannedAt: c.lastScannedAt?.toISOString(),
          createdAt: c.createdAt.toISOString()
        })),
        discoveredContent: storedContent,
        agentMemories: storedMemories
      }
    })
  } catch (error: any) {
    console.error('[Test Extraction] Unexpected error:', error)
    console.error('[Test Extraction] Error stack:', error.stack)
    return NextResponse.json(
      { 
        error: error.message || 'Failed to extract URLs',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}
