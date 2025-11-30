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
  prioritizeCitations: (citations: WikiCitation[], sourceUrl: string) => Promise<Array<WikiCitation & { score?: number }>>
): Promise<{ citationsFound: number; citationsStored: number }> {
  console.log(`[WikipediaCitation] Extracting citations from ${wikipediaUrl}`)

  // Extract citations with context (ALL citations, no limit)
  const citations = extractWikipediaCitationsWithContext(htmlContent, wikipediaUrl, 10000)
  console.log(`[WikipediaCitation] Found ${citations.length} citations`)

  if (citations.length === 0) {
    return { citationsFound: 0, citationsStored: 0 }
  }

  // Prioritize citations using AI (for scoring, but store ALL)
  const prioritized = await prioritizeCitations(citations, wikipediaUrl)
  console.log(`[WikipediaCitation] Prioritized ${prioritized.length} citations (storing all)`)

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
    } catch (error) {
      console.error(`[WikipediaCitation] Error storing citation ${sourceNumber}:`, error)
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

  console.log(`[WikipediaCitation] Stored ${citationsStored} new citations`)
  return { citationsFound: citations.length, citationsStored }
}

/**
 * Get next citation to process (for incremental processing)
 * Returns highest priority unprocessed citation
 */
export async function getNextCitationToProcess(
  patchId: string
): Promise<{
  id: string
  citationUrl: string
  citationTitle: string | null
  sourceNumber: number
  monitoringId: string
} | null> {
  const citation = await prisma.wikipediaCitation.findFirst({
    where: {
      monitoring: { patchId },
      verificationStatus: { in: ['pending', 'verified'] },
      scanStatus: { in: ['not_scanned', 'scanning'] },
      relevanceDecision: null // Not yet decided
    },
    orderBy: [
      { aiPriorityScore: 'desc' },
      { createdAt: 'asc' }
    ],
    include: {
      monitoring: {
        select: {
          id: true
        }
      }
    }
  })

  if (!citation) return null

  return {
    id: citation.id,
    citationUrl: citation.citationUrl,
    citationTitle: citation.citationTitle,
    sourceNumber: citation.sourceNumber,
    monitoringId: citation.monitoringId
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
  await prisma.wikipediaCitation.update({
    where: { id: citationId },
    data: {
      verificationStatus: 'failed',
      errorMessage
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
  savedMemoryId?: string
): Promise<void> {
  await prisma.wikipediaCitation.update({
    where: { id: citationId },
    data: {
      scanStatus: 'scanned',
      relevanceDecision,
      savedContentId: savedContentId || null,
      savedMemoryId: savedMemoryId || null,
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

