/**
 * Wikipedia Citation Service
 * Manages citations extracted from Wikipedia pages
 * Handles extraction, storage, prioritization, and processing state
 */

import { prisma } from '@/lib/prisma'
import { extractWikipediaCitationsWithContext, WikipediaCitation as WikiCitation } from './wikiUtils'
import { canonicalizeUrlFast } from './canonicalize'

/**
 * Extract and store citations from a Wikipedia page
 */
export async function extractAndStoreCitations(
  monitoringId: string,
  wikipediaUrl: string,
  htmlContent: string,
  prioritizeCitations: (citations: WikiCitation[], sourceUrl: string) => Promise<Array<WikiCitation & { score?: number }>>,
  onProgress?: (event: { type: string; data: any }) => void
): Promise<{ citationsFound: number; citationsStored: number }> {
  const emit = (type: string, data: any) => {
    if (onProgress) {
      onProgress({ type, data })
    }
    console.log(JSON.stringify({ tag: 'citation_extraction', type, ...data }))
  }

  emit('extraction_started', { wikipediaUrl, monitoringId })
  console.log(`[WikipediaCitation] Extracting citations from ${wikipediaUrl}`)

  // Extract citations with context (ALL citations, no limit)
  const citations = extractWikipediaCitationsWithContext(htmlContent, wikipediaUrl, 10000)
  
  // Validate: Check for Wikipedia URLs that shouldn't be here
  const wikipediaUrls = citations.filter(c => {
    const url = c.url
    return url.includes('wikipedia.org') || url.includes('wikimedia.org') || url.includes('wikidata.org') ||
           url.startsWith('./') || url.startsWith('/wiki/')
  })
  
  if (wikipediaUrls.length > 0) {
    console.warn(`[WikipediaCitation] WARNING: ${wikipediaUrls.length} Wikipedia URLs found in extraction results - these should have been filtered`)
    emit('extraction_warning', { 
      message: 'Wikipedia URLs found in extraction results',
      count: wikipediaUrls.length,
      sampleUrls: wikipediaUrls.slice(0, 5).map(u => u.url)
    })
  }
  
  // Count by section
  const bySection = citations.reduce((acc, c) => {
    const section = c.context?.includes('References') ? 'References' :
                   c.context?.includes('Further reading') ? 'Further reading' :
                   c.context?.includes('External links') ? 'External links' : 'Unknown'
    acc[section] = (acc[section] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  
  // Validation: Ensure we found citations from expected sections
  const hasReferences = bySection['References'] > 0
  const hasExternalLinks = bySection['External links'] > 0
  const hasFurtherReading = bySection['Further reading'] > 0
  
  emit('extraction_complete', { 
    totalFound: citations.length,
    bySection,
    validation: {
      hasReferences,
      hasExternalLinks,
      hasFurtherReading,
      wikipediaUrlsFound: wikipediaUrls.length
    }
  })
  console.log(`[WikipediaCitation] Found ${citations.length} citations`)

  if (citations.length === 0) {
    emit('extraction_complete', { totalFound: 0, citationsStored: 0 })
    return { citationsFound: 0, citationsStored: 0 }
  }

  emit('prioritization_started', { count: citations.length })
  // Prioritize citations using AI (for scoring, but store ALL)
  const prioritized = await prioritizeCitations(citations, wikipediaUrl)
  emit('prioritization_complete', { count: prioritized.length })
  console.log(`[WikipediaCitation] Prioritized ${prioritized.length} citations (storing all)`)

  emit('storage_started', { count: prioritized.length })
  // Store ALL citations in database (not just top 25)
  let citationsStored = 0
  for (let i = 0; i < prioritized.length; i++) {
    const citation = prioritized[i]
    const sourceNumber = i + 1 // Reference number on Wikipedia page

    try {
      // Check if already exists
      const existing = await prisma.wikipediaCitation.findUnique({
        where: {
          monitoringId_sourceNumber: {
            monitoringId,
            sourceNumber
          }
        }
      })

      if (existing) {
        // Update if priority score changed
        if (citation.score !== undefined && citation.score !== existing.aiPriorityScore) {
          await prisma.wikipediaCitation.update({
            where: { id: existing.id },
            data: { aiPriorityScore: citation.score }
          })
        }
        emit('citation_skipped', { sourceNumber, reason: 'duplicate', url: citation.url })
        continue
      }

      // Create new citation entry
      await prisma.wikipediaCitation.create({
        data: {
          monitoringId,
          sourceNumber,
          citationUrl: citation.url,
          citationTitle: citation.title,
          citationContext: citation.context,
          aiPriorityScore: citation.score,
          verificationStatus: 'pending',
          scanStatus: 'not_scanned'
        }
      })
      citationsStored++
      emit('citation_stored', { 
        sourceNumber, 
        url: citation.url, 
        title: citation.title,
        score: citation.score 
      })
    } catch (error) {
      console.error(`[WikipediaCitation] Error storing citation ${sourceNumber}:`, error)
      emit('citation_error', { sourceNumber, error: String(error) })
    }
  }

  // Update monitoring record
  await prisma.wikipediaMonitoring.update({
    where: { id: monitoringId },
    data: {
      citationCount: prioritized.length,
      citationsExtracted: true,
      lastExtractedAt: new Date()
    }
  })

  emit('storage_complete', { citationsStored, totalFound: citations.length })
  console.log(`[WikipediaCitation] Stored ${citationsStored} new citations`)
  return { citationsFound: citations.length, citationsStored }
}

/**
 * Get next citation to process (for incremental processing)
 * Returns highest priority unprocessed citation
 */
/**
 * Get next citation to process (verify and scan)
 * Returns citation with highest AI priority score that hasn't been scanned yet
 * 
 * IMPORTANT: Citations are processed independently of page status.
 * Once citations are extracted, they should be processed regardless of
 * whether their parent page is marked "completed" or not.
 */
export async function getNextCitationToProcess(
  patchId: string
): Promise<{
  id: string
  citationUrl: string
  citationTitle: string | null
  sourceNumber: number
  monitoringId: string
  aiPriorityScore: number | null
} | null> {
  // Prioritize processing unprocessed citations first
  // Include 'failed' verification status - these may still be valid URLs that failed verification checks
  // but should be processed if they haven't been scanned yet
  // Fix 2: Stop re-selection loop - exclude scanned_denied citations
  const citation = await prisma.wikipediaCitation.findFirst({
    where: {
      monitoring: { patchId },
      verificationStatus: { in: ['pending', 'verified'] }, // Exclude 'failed' - they're marked as scanned_denied
      scanStatus: 'not_scanned', // Only process not_scanned (exclude scanning, scanned, scanned_denied)
      relevanceDecision: null // Only process citations that haven't been decided yet
    },
    orderBy: [
      { aiPriorityScore: 'desc' },
      { createdAt: 'asc' }
    ],
    include: {
      monitoring: {
        select: {
          id: true,
          wikipediaTitle: true,
          status: true
        }
      }
    }
  })

  if (!citation) {
    // Enhanced diagnostic logging to understand why no citations are found
    const totalCitations = await prisma.wikipediaCitation.count({
      where: { monitoring: { patchId } }
    })

    const pendingCitations = await prisma.wikipediaCitation.count({
      where: {
        monitoring: { patchId },
        verificationStatus: 'pending',
        scanStatus: 'not_scanned',
        relevanceDecision: null
      }
    })

    const verifiedCitations = await prisma.wikipediaCitation.count({
      where: {
        monitoring: { patchId },
        verificationStatus: 'verified',
        scanStatus: 'not_scanned',
        relevanceDecision: null
      }
    })

    const scannedCitations = await prisma.wikipediaCitation.count({
      where: {
        monitoring: { patchId },
        scanStatus: 'scanned'
      }
    })

    const withRelevanceDecision = await prisma.wikipediaCitation.count({
      where: {
        monitoring: { patchId },
        relevanceDecision: { not: null }
      }
    })

    console.log(`[WikipediaCitation] No citations available to process for patch ${patchId}`)
    console.log(`[WikipediaCitation] Diagnostic breakdown:`)
    console.log(`  Total citations: ${totalCitations}`)
    console.log(`  Pending + not_scanned + no decision: ${pendingCitations}`)
    console.log(`  Verified + not_scanned + no decision: ${verifiedCitations}`)
    console.log(`  Already scanned: ${scannedCitations}`)
    console.log(`  Already have relevanceDecision: ${withRelevanceDecision}`)
    console.log(`  Query conditions: verificationStatus IN ['pending','verified'] AND scanStatus IN ['not_scanned','scanning'] AND relevanceDecision IS NULL`)

    // If there are citations but they don't match, show why
    if (totalCitations > 0 && pendingCitations === 0 && verifiedCitations === 0) {
      const failedVerification = await prisma.wikipediaCitation.count({
        where: {
          monitoring: { patchId },
          verificationStatus: 'failed'
        }
      })

      const scanning = await prisma.wikipediaCitation.count({
        where: {
          monitoring: { patchId },
          scanStatus: 'scanning'
        }
      })

      console.log(`  Failed verification: ${failedVerification}`)
      console.log(`  Currently scanning: ${scanning}`)
      
      if (scannedCitations === totalCitations) {
        console.log(`  ℹ️  All citations have been scanned`)
      } else if (withRelevanceDecision === totalCitations) {
        console.log(`  ℹ️  All citations have a relevance decision`)
      } else {
        console.log(`  ⚠️  Some citations may be in unexpected states`)
      }
    }

    return null
  }

  console.log(`[WikipediaCitation] Found citation to process: "${citation.citationTitle || 'Untitled'}" (priority: ${citation.aiPriorityScore || 'N/A'}) from page "${citation.monitoring.wikipediaTitle}" (status: ${citation.monitoring.status})`)

  return {
    id: citation.id,
    citationUrl: citation.citationUrl,
    citationTitle: citation.citationTitle,
    sourceNumber: citation.sourceNumber,
    monitoringId: citation.monitoringId,
    aiPriorityScore: citation.aiPriorityScore
  }
}

/**
 * Mark citation as being verified
 */
export async function markCitationVerifying(
  citationId: string
): Promise<void> {
  await prisma.wikipediaCitation.update({
    where: { id: citationId },
    data: {
      verificationStatus: 'verified',
      lastVerifiedAt: new Date()
    }
  })
}

/**
 * Mark citation verification as failed
 */
export async function markCitationVerificationFailed(
  citationId: string,
  errorMessage: string
): Promise<void> {
  // Fix 2: Stop re-selection loop - mark as scanned_denied to prevent re-selection
  await prisma.wikipediaCitation.update({
    where: { id: citationId },
    data: {
      verificationStatus: 'failed',
      errorMessage,
      scanStatus: 'scanned_denied', // Prevent re-selection
      relevanceDecision: 'denied_verify' // Mark as denied due to verification failure
    }
  })
}

/**
 * Mark citation as being scanned
 */
export async function markCitationScanning(
  citationId: string
): Promise<void> {
  await prisma.wikipediaCitation.update({
    where: { id: citationId },
    data: {
      scanStatus: 'scanning',
      lastScannedAt: new Date()
    }
  })
}

/**
 * Mark citation as scanned and save decision
 */
export async function markCitationScanned(
  citationId: string,
  relevanceDecision: 'saved' | 'denied',
  savedContentId?: string,
  savedMemoryId?: string,
  contentText?: string,
  aiPriorityScore?: number
): Promise<void> {
  await prisma.wikipediaCitation.update({
    where: { id: citationId },
    data: {
      scanStatus: 'scanned',
      relevanceDecision,
      savedContentId: savedContentId || null,
      savedMemoryId: savedMemoryId || null,
      contentText: contentText || null,
      aiPriorityScore: aiPriorityScore !== undefined ? aiPriorityScore : null,
      lastScannedAt: new Date()
    }
  })
}

/**
 * Get citation statistics for a patch
 */
export async function getCitationStats(
  patchId: string
): Promise<{
  total: number
  pending: number
  verified: number
  failed: number
  scanned: number
  saved: number
  denied: number
}> {
  const [total, pending, verified, failed, scanned, saved, denied] = await Promise.all([
    prisma.wikipediaCitation.count({
      where: { monitoring: { patchId } }
    }),
    prisma.wikipediaCitation.count({
      where: {
        monitoring: { patchId },
        verificationStatus: 'pending'
      }
    }),
    prisma.wikipediaCitation.count({
      where: {
        monitoring: { patchId },
        verificationStatus: 'verified'
      }
    }),
    prisma.wikipediaCitation.count({
      where: {
        monitoring: { patchId },
        verificationStatus: 'failed'
      }
    }),
    prisma.wikipediaCitation.count({
      where: {
        monitoring: { patchId },
        scanStatus: 'scanned'
      }
    }),
    prisma.wikipediaCitation.count({
      where: {
        monitoring: { patchId },
        relevanceDecision: 'saved'
      }
    }),
    prisma.wikipediaCitation.count({
      where: {
        monitoring: { patchId },
        relevanceDecision: 'denied'
      }
    })
  ])

  return { total, pending, verified, failed, scanned, saved, denied }
}

