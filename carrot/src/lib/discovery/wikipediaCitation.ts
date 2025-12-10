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
  
  // Separate external URLs from Wikipedia internal links
  // Wikipedia internal links will be stored but marked for later processing
  const externalCitations: typeof citations = []
  const wikipediaCitations: typeof citations = []
  
  for (const citation of citations) {
    const url = citation.url
    // Check if it's a Wikipedia internal link
    const isWikipediaLink = url.startsWith('./') || 
                           url.startsWith('/wiki/') || 
                           url.startsWith('../') ||
                           url.includes('wikipedia.org') || 
                           url.includes('wikimedia.org') || 
                           url.includes('wikidata.org')
    
    if (isWikipediaLink) {
      wikipediaCitations.push(citation)
    } else {
      externalCitations.push(citation)
    }
  }
  
  // Log separation
  if (wikipediaCitations.length > 0) {
    console.log(`[WikipediaCitation] Found ${wikipediaCitations.length} Wikipedia internal links (will be categorized for later scanning)`)
    emit('extraction_info', { 
      message: 'Wikipedia internal links identified for later processing',
      wikipediaLinksCount: wikipediaCitations.length,
      externalLinksCount: externalCitations.length
    })
  }
  
  // Count by section (use all citations for reporting)
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
    externalUrls: externalCitations.length,
    wikipediaLinks: wikipediaCitations.length,
    bySection,
    validation: {
      hasReferences,
      hasExternalLinks,
      hasFurtherReading,
      wikipediaLinksFound: wikipediaCitations.length
    }
  })
  console.log(`[WikipediaCitation] Found ${citations.length} total citations (${externalCitations.length} external, ${wikipediaCitations.length} Wikipedia internal)`)

  if (citations.length === 0) {
    emit('extraction_complete', { totalFound: 0, citationsStored: 0 })
    return { citationsFound: 0, citationsStored: 0 }
  }

  // Prioritize external URLs first (these will be processed immediately)
  emit('prioritization_started', { count: externalCitations.length })
  const prioritizedExternal = externalCitations.length > 0 
    ? await prioritizeCitations(externalCitations, wikipediaUrl)
    : []
  
  // Wikipedia internal links get default priority (they'll be processed later if relevant)
  const prioritizedWikipedia = wikipediaCitations.map(c => ({ ...c, score: 50 }))
  
  // Combine: external URLs first, then Wikipedia links
  const prioritized = [...prioritizedExternal, ...prioritizedWikipedia]
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

      // Check if this is a Wikipedia internal link
      const isWikipediaLink = citation.url.startsWith('./') || 
                              citation.url.startsWith('/wiki/') || 
                              citation.url.startsWith('../') ||
                              citation.url.includes('wikipedia.org') || 
                              citation.url.includes('wikimedia.org') || 
                              citation.url.includes('wikidata.org')
      
      // Create new citation entry
      // Wikipedia internal links are marked as 'pending_wiki' status to indicate they need Wikipedia-to-Wikipedia processing
      // External URLs are marked as 'pending' for immediate processing
      await prisma.wikipediaCitation.create({
        data: {
          monitoringId,
          sourceNumber,
          citationUrl: citation.url,
          citationTitle: citation.title,
          citationContext: citation.context,
          aiPriorityScore: citation.score,
          verificationStatus: isWikipediaLink ? 'pending_wiki' : 'pending', // Mark Wikipedia links differently
          scanStatus: 'not_scanned' // Both types start as not_scanned, but query will prioritize external
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
  // Step 1: Prioritize processing external URLs first (not Wikipedia internal links)
  // Wikipedia internal links are marked with verificationStatus='pending_wiki' and will be processed later
  // when they're added to monitoring if relevant
  let citation = await prisma.wikipediaCitation.findFirst({
    where: {
      monitoring: { patchId },
      verificationStatus: { in: ['pending', 'verified'] }, // Only external URLs (pending_wiki excluded)
      scanStatus: { in: ['not_scanned', 'scanning'] }, // Include 'scanning' in case a process crashed
      relevanceDecision: null, // Only process citations that haven't been decided yet
      // Exclude Wikipedia internal links - these are marked as 'pending_wiki' but also filter by URL pattern as defensive check
      NOT: [
        { citationUrl: { startsWith: './' } },
        { citationUrl: { startsWith: '/wiki/' } },
        { citationUrl: { contains: 'wikipedia.org' } },
        { citationUrl: { contains: 'wikimedia.org' } },
        { citationUrl: { contains: 'wikidata.org' } }
      ]
    },
    orderBy: [
      // Prioritize citations with AI scores first, then by creation date
      // Use nullsLast to ensure citations without scores are still processed
      { aiPriorityScore: { sort: 'desc', nulls: 'last' } },
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

  // Step 2: If no external URLs available, process Wikipedia internal links (pending_wiki)
  // This ensures Wikipedia links get processed after external URLs are done
  if (!citation) {
    citation = await prisma.wikipediaCitation.findFirst({
      where: {
        monitoring: { patchId },
        verificationStatus: 'pending_wiki', // Wikipedia internal links
        scanStatus: { in: ['not_scanned', 'scanning'] }, // Include 'scanning' in case a process crashed
        relevanceDecision: null, // Only process citations that haven't been decided yet
        // Include Wikipedia internal links - these are the ones we want to process now
        OR: [
          { citationUrl: { startsWith: './' } },
          { citationUrl: { startsWith: '/wiki/' } },
          { citationUrl: { contains: 'wikipedia.org' } },
          { citationUrl: { contains: 'wikimedia.org' } },
          { citationUrl: { contains: 'wikidata.org' } }
        ]
      },
      orderBy: [
        // Prioritize citations with AI scores first, then by creation date
        { aiPriorityScore: { sort: 'desc', nulls: 'last' } },
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
  }

  // Step 3: If still no citations, look for high-scoring denied citations that might have been incorrectly denied
  // These are citations that scored >= 60 (high relevance) but were still denied - likely a bug
  // CRITICAL FIX: Remove 30-day requirement - if we just fixed the scoring logic, we should reprocess immediately
  // Prioritize highest scores first, regardless of when they were last scanned
  if (!citation) {
    citation = await prisma.wikipediaCitation.findFirst({
      where: {
        monitoring: { patchId },
        verificationStatus: { in: ['pending', 'verified'] },
        relevanceDecision: 'denied', // Was denied but might be incorrectly denied
        aiPriorityScore: { gte: 60 }, // High score but denied - likely a bug
        // Allow already-scanned citations for reprocessing (removed 30-day requirement)
        scanStatus: { in: ['not_scanned', 'scanning', 'scanned'] },
        NOT: [
          { citationUrl: { startsWith: './' } },
          { citationUrl: { startsWith: '/wiki/' } },
          { citationUrl: { contains: 'wikipedia.org' } },
          { citationUrl: { contains: 'wikimedia.org' } },
          { citationUrl: { contains: 'wikidata.org' } }
        ]
      },
      orderBy: [
        { aiPriorityScore: { sort: 'desc', nulls: 'last' } }, // Highest scores first
        { lastScannedAt: { sort: 'asc', nulls: 'last' } }, // Oldest scans first (but not required)
        { createdAt: 'asc' } // Fallback to createdAt if lastScannedAt is null
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
    
    if (citation) {
      console.log(`[WikipediaCitation] Found high-scoring denied citation for reprocessing: "${citation.citationTitle}" (score: ${citation.aiPriorityScore}, denied but score >= 60)`)
      // Reset scanStatus and relevanceDecision to allow reprocessing
      await prisma.wikipediaCitation.update({
        where: { id: citation.id },
        data: { scanStatus: 'not_scanned', relevanceDecision: null }
      })
      // Refetch to get updated values
      const updated = await prisma.wikipediaCitation.findUnique({
        where: { id: citation.id },
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
      if (updated) citation = updated
    }
  }

  // Step 4: If still no citations, look for citations marked as "saved" but save failed (savedContentId is null)
  // These are citations that were marked as saved but the actual save to DiscoveredContent failed
  if (!citation) {
    citation = await prisma.wikipediaCitation.findFirst({
      where: {
        monitoring: { patchId },
        verificationStatus: { in: ['pending', 'verified'] },
        relevanceDecision: 'saved', // Marked as saved
        savedContentId: null, // But save actually failed
        // Allow already-scanned citations for reprocessing
        scanStatus: { in: ['not_scanned', 'scanning', 'scanned'] },
        NOT: [
          { citationUrl: { startsWith: './' } },
          { citationUrl: { startsWith: '/wiki/' } },
          { citationUrl: { contains: 'wikipedia.org' } },
          { citationUrl: { contains: 'wikimedia.org' } },
          { citationUrl: { contains: 'wikidata.org' } }
        ]
      },
      orderBy: [
        { aiPriorityScore: { sort: 'desc', nulls: 'last' } },
        { lastScannedAt: 'asc' }
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
    
    if (citation) {
      console.log(`[WikipediaCitation] Found citation with failed save for reprocessing: "${citation.citationTitle}" (marked as saved but savedContentId is null)`)
      // Reset scanStatus and relevanceDecision to allow reprocessing
      await prisma.wikipediaCitation.update({
        where: { id: citation.id },
        data: { scanStatus: 'not_scanned', relevanceDecision: null }
      })
      // Refetch to get updated values
      const updated = await prisma.wikipediaCitation.findUnique({
        where: { id: citation.id },
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
      if (updated) citation = updated
    }
  }

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

    // Check for pending_wiki citations
    const pendingWikiCitations = await prisma.wikipediaCitation.count({
      where: {
        monitoring: { patchId },
        verificationStatus: 'pending_wiki',
        scanStatus: 'not_scanned',
        relevanceDecision: null
      }
    })

    console.log(`[WikipediaCitation] No citations available to process for patch ${patchId}`)
    console.log(`[WikipediaCitation] Diagnostic breakdown:`)
    console.log(`  Total citations: ${totalCitations}`)
    console.log(`  Pending external + not_scanned + no decision: ${pendingCitations}`)
    console.log(`  Verified external + not_scanned + no decision: ${verifiedCitations}`)
    console.log(`  Pending Wikipedia internal links (pending_wiki): ${pendingWikiCitations}`)
    console.log(`  Already scanned: ${scannedCitations}`)
    console.log(`  Already have relevanceDecision: ${withRelevanceDecision}`)
    console.log(`  Query conditions: First tries verificationStatus IN ['pending','verified'], then falls back to 'pending_wiki'`)

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
        
        // Check for reprocessing candidates
        const highScoringDenied = await prisma.wikipediaCitation.count({
          where: {
            monitoring: { patchId },
            relevanceDecision: 'denied',
            aiPriorityScore: { gte: 60 },
            lastScannedAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // 30 days ago
          }
        })
        
        const failedSaves = await prisma.wikipediaCitation.count({
          where: {
            monitoring: { patchId },
            relevanceDecision: 'saved',
            savedContentId: null
          }
        })
        
        if (highScoringDenied > 0 || failedSaves > 0) {
          console.log(`  🔄 Reprocessing candidates available:`)
          console.log(`    - High-scoring denied (score >= 60, processed >30 days ago): ${highScoringDenied}`)
          console.log(`    - Failed saves (marked saved but savedContentId is null): ${failedSaves}`)
        }
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

