import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ handle: string }> }
) {
  try {
    const { handle } = await params
    
    // Get patch
    const patch = await prisma.patch.findUnique({
      where: { handle },
      select: { id: true, title: true }
    })
    
    if (!patch) {
      return NextResponse.json({ error: 'Patch not found' }, { status: 404 })
    }
    
    // Get all citations with full details
    const citations = await prisma.wikipediaCitation.findMany({
      where: {
        monitoring: {
          patchId: patch.id
        }
      },
      select: {
        id: true,
        citationUrl: true,
        citationTitle: true,
        citationContext: true,
        sourceNumber: true,
        aiPriorityScore: true,
        verificationStatus: true,
        scanStatus: true,
        relevanceDecision: true,
        savedContentId: true,
        savedMemoryId: true,
        contentText: true,
        errorMessage: true,
        lastScannedAt: true,
        createdAt: true,
        monitoring: {
          select: {
            id: true,
            wikipediaTitle: true,
            wikipediaUrl: true
          }
        }
      },
      orderBy: [
        { aiPriorityScore: { sort: 'desc', nulls: 'last' } },
        { createdAt: 'desc' }
      ]
    })
    
    // Get saved content details for citations that were saved
    const savedContentIds = citations
      .filter(c => c.savedContentId)
      .map(c => c.savedContentId!)
      .filter((id): id is string => id !== null)
    
    const savedContent = await prisma.discoveredContent.findMany({
      where: {
        id: { in: savedContentIds }
      },
      select: {
        id: true,
        title: true,
        textContent: true,
        contentHash: true,
        lastCrawledAt: true,
        createdAt: true,
        relevanceScore: true,
        qualityScore: true
      }
    })
    
    const contentMap = new Map(savedContent.map(c => [c.id, c]))
    
    // Get agent memories for saved content
    const agentMemories = await prisma.agentMemory.findMany({
      where: {
        patchId: patch.id,
        discoveredContentId: { in: savedContentIds }
      },
      select: {
        id: true,
        discoveredContentId: true,
        contentHash: true,
        createdAt: true
      }
    })
    
    const memoryMap = new Map(agentMemories.map(m => [m.discoveredContentId, m]))
    
    // Enrich citations with extraction and agent learning status
    const enrichedCitations = citations.map(citation => {
      const content = citation.savedContentId ? contentMap.get(citation.savedContentId) : null
      const memory = citation.savedContentId ? memoryMap.get(citation.savedContentId) : null
      
      // Determine extraction status
      let extractionStatus: 'success' | 'error' | 'pending' | 'not_saved' = 'not_saved'
      let extractionError: string | null = null
      
      if (citation.savedContentId) {
        if (content) {
          if (content.textContent && content.textContent.length > 0) {
            extractionStatus = 'success'
          } else {
            extractionStatus = 'error'
            extractionError = 'No text content extracted'
          }
        } else {
          extractionStatus = 'error'
          extractionError = 'SavedContent record not found'
        }
      } else if (citation.relevanceDecision === 'saved') {
        extractionStatus = 'error'
        extractionError = 'Marked as saved but savedContentId is null'
      } else {
        extractionStatus = 'pending'
      }
      
      // Check for citation-level errors
      if (citation.errorMessage) {
        extractionStatus = 'error'
        extractionError = citation.errorMessage
      }
      
      return {
        id: citation.id,
        url: citation.citationUrl,
        title: citation.citationTitle,
        context: citation.citationContext,
        sourceNumber: citation.sourceNumber,
        wikipediaPage: {
          title: citation.monitoring.wikipediaTitle,
          url: citation.monitoring.wikipediaUrl
        },
        relevance: {
          score: citation.aiPriorityScore,
          decision: citation.relevanceDecision,
          status: citation.scanStatus,
          verificationStatus: citation.verificationStatus
        },
        extraction: {
          status: extractionStatus,
          error: extractionError,
          hasContent: citation.contentText ? citation.contentText.length > 0 : false,
          contentLength: citation.contentText?.length || 0
        },
        saved: {
          savedContentId: citation.savedContentId,
          hasSavedContent: !!content,
          savedContentTitle: content?.title || null,
          textContentLength: content?.textContent?.length || 0,
          hasTextContent: content?.textContent ? content.textContent.length > 0 : false,
          savedAt: content?.createdAt || null,
          lastCrawledAt: content?.lastCrawledAt || null
        },
        agentLearning: {
          hasMemory: !!memory,
          memoryId: memory?.id || null,
          learnedAt: memory?.createdAt || null
        },
        timestamps: {
          createdAt: citation.createdAt,
          lastScannedAt: citation.lastScannedAt
        }
      }
    })
    
    // Calculate summary statistics
    const total = citations.length
    const scanned = citations.filter(c => c.scanStatus === 'scanned').length
    const saved = citations.filter(c => c.savedContentId !== null).length
    const extracted = enrichedCitations.filter(c => c.extraction.status === 'success').length
    const withMemory = enrichedCitations.filter(c => c.agentLearning.hasMemory).length
    const withErrors = enrichedCitations.filter(c => c.extraction.status === 'error').length
    
    const withScore = citations.filter(c => c.aiPriorityScore !== null).length
    const avgScore = withScore > 0
      ? citations
          .filter(c => c.aiPriorityScore !== null)
          .reduce((sum, c) => sum + (c.aiPriorityScore || 0), 0) / withScore
      : 0
    
    return NextResponse.json({
      patch: {
        id: patch.id,
        title: patch.title,
        handle
      },
      summary: {
        total,
        scanned,
        saved,
        extracted,
        withMemory,
        withErrors,
        withScore,
        avgScore: Math.round(avgScore * 100) / 100,
        scanRate: total > 0 ? Math.round((scanned / total) * 1000) / 10 : 0,
        saveRate: scanned > 0 ? Math.round((saved / scanned) * 1000) / 10 : 0,
        extractionRate: saved > 0 ? Math.round((extracted / saved) * 1000) / 10 : 0,
        learningRate: saved > 0 ? Math.round((withMemory / saved) * 1000) / 10 : 0
      },
      citations: enrichedCitations
    })
  } catch (error: any) {
    console.error('[Citations Audit API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch citations audit' },
      { status: 500 }
    )
  }
}

