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
    const response = await fetch('https://en.wikipedia.org/wiki/Apartheid', {
      headers: {
        'User-Agent': 'CarrotBot/1.0 (https://carrot-app.onrender.com)'
      }
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch Wikipedia page: ${response.status}` },
        { status: response.status }
      )
    }

    const html = await response.text()
    
    // Extract URLs (for comparison)
    const extractedUrls = extractAllExternalUrls(html, 'https://en.wikipedia.org/wiki/Apartheid')
    
    // Get ALL stored citations from database for Israel patch
    // Filter to show external URLs first, then Wikipedia URLs
    const allStoredCitations = await prisma.wikipediaCitation.findMany({
      where: {
        monitoring: { patchId: patch.id }
      },
      include: {
        monitoring: {
          select: {
            wikipediaTitle: true,
            wikipediaUrl: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 2000 // Increased limit
    })

    // Separate external vs Wikipedia URLs
    const externalCitations = allStoredCitations.filter(c => 
      !c.citationUrl.includes('wikipedia.org')
    )
    const wikipediaCitations = allStoredCitations.filter(c => 
      c.citationUrl.includes('wikipedia.org')
    )

    // Prioritize external citations in the list
    const storedCitations = [...externalCitations, ...wikipediaCitations]

    // Get stored DiscoveredContent
    const storedContent = await prisma.discoveredContent.findMany({
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

    // Get stored AgentMemories
    const storedMemories = await prisma.agentMemory.findMany({
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
          contentText: c.contentText ? c.contentText.substring(0, 500) + (c.contentText.length > 500 ? '...' : '') : null,
          contentLength: c.contentText?.length || 0,
          aiScore: c.aiPriorityScore,
          scanStatus: c.scanStatus,
          relevanceDecision: c.relevanceDecision,
          verificationStatus: c.verificationStatus,
          savedContentId: c.savedContentId,
          savedMemoryId: c.savedMemoryId,
          errorMessage: c.errorMessage,
          fromWikipediaPage: c.monitoring.wikipediaTitle,
          lastScannedAt: c.lastScannedAt?.toISOString(),
          createdAt: c.createdAt.toISOString()
        })),
        discoveredContent: storedContent,
        agentMemories: storedMemories
      }
    })
  } catch (error: any) {
    console.error('[Test Extraction] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to extract URLs' },
      { status: 500 }
    )
  }
}
