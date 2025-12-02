/**
 * Wikipedia Monitoring Service
 * Manages Wikipedia pages being monitored for each patch
 * Handles initial search, storage, and incremental processing
 */

import { prisma } from '@/lib/prisma'
import { WikipediaSource } from './wikipediaSource'
import { canonicalizeUrlFast } from './canonicalize'

export interface WikipediaSearchResult {
  title: string
  url: string
  relevance: number
}

/**
 * Initialize Wikipedia monitoring for a patch
 * Searches Wikipedia using page name + key terms and stores results
 */
export async function initializeWikipediaMonitoring(
  patchId: string,
  pageName: string,
  searchTerms: string[]
): Promise<{ pagesFound: number; pagesStored: number }> {
  console.log(`[WikipediaMonitoring] Initializing for patch ${patchId}`)
  console.log(`[WikipediaMonitoring] Page: "${pageName}", Terms: ${searchTerms.join(', ')}`)
  
  // Structured logging
  try {
    const { structuredLog } = await import('./structuredLogger')
    structuredLog('wikipedia_monitoring_init', {
      patchId,
      pageName,
      searchTerms: searchTerms.length,
      timestamp: new Date().toISOString()
    })
  } catch {
    // Non-fatal if structured logger unavailable
  }

  // Combine page name with search terms
  const allSearchTerms = [pageName, ...searchTerms].filter(Boolean)
  const uniqueTerms = Array.from(new Set(allSearchTerms))
  
  const foundPages = new Map<string, WikipediaSearchResult>()
  
  // Search Wikipedia for each term
  for (const term of uniqueTerms) {
    try {
      const titles = await WikipediaSource.search(term, 5) // Get top 5 results per term
      
      for (const title of titles) {
        const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`
        const canonical = canonicalizeUrlFast(url)
        
        if (!canonical) continue
        if (foundPages.has(canonical)) {
          // Increase relevance if found by multiple terms
          const existing = foundPages.get(canonical)!
          existing.relevance += 1
        } else {
          foundPages.set(canonical, {
            title,
            url: canonical,
            relevance: 1
          })
        }
      }
      
      // Rate limiting: wait between searches
      await new Promise(resolve => setTimeout(resolve, 1000))
    } catch (error) {
      console.error(`[WikipediaMonitoring] Error searching for "${term}":`, error)
    }
  }

  console.log(`[WikipediaMonitoring] Found ${foundPages.size} unique Wikipedia pages`)

  // Structured logging for search results
  try {
    const { structuredLog } = await import('./structuredLogger')
    structuredLog('wikipedia_search_complete', {
      patchId,
      searchTerms: uniqueTerms.length,
      pagesFound: foundPages.size,
      timestamp: new Date().toISOString()
    })
  } catch {
    // Non-fatal
  }

  // Store pages in database
  let pagesStored = 0
  for (const [url, result] of foundPages.entries()) {
    try {
      // Check if already exists
      const existing = await prisma.wikipediaMonitoring.findUnique({
        where: {
          patchId_wikipediaUrl: {
            patchId,
            wikipediaUrl: url
          }
        }
      })

      if (existing) {
        // Update priority if relevance increased
        if (result.relevance > (existing.priority || 0)) {
          await prisma.wikipediaMonitoring.update({
            where: { id: existing.id },
            data: { priority: result.relevance }
          })
        }
        continue
      }

      // Create new monitoring entry
      await prisma.wikipediaMonitoring.create({
        data: {
          patchId,
          wikipediaUrl: url,
          wikipediaTitle: result.title,
          searchTerm: pageName, // Primary search term that found this
          priority: result.relevance,
          status: 'pending'
        }
      })
      pagesStored++
    } catch (error) {
      console.error(`[WikipediaMonitoring] Error storing page "${result.title}":`, error)
    }
  }

  console.log(`[WikipediaMonitoring] Stored ${pagesStored} new pages`)
  
  // Structured logging for storage results
  try {
    const { structuredLog } = await import('./structuredLogger')
    structuredLog('wikipedia_monitoring_stored', {
      patchId,
      pagesFound: foundPages.size,
      pagesStored,
      timestamp: new Date().toISOString()
    })
  } catch {
    // Non-fatal
  }
  
  return { pagesFound: foundPages.size, pagesStored }
}

/**
 * Get next Wikipedia page to process (for incremental processing)
 */
export async function getNextWikipediaPageToProcess(
  patchId: string
): Promise<{ id: string; url: string; title: string } | null> {
  // First, try to find pages that need content scanning or citation extraction
  let page = await prisma.wikipediaMonitoring.findFirst({
    where: {
      patchId,
      status: { in: ['pending', 'scanning', 'error'] }, // Include 'error' to allow retry
      OR: [
        { contentScanned: false },
        { citationsExtracted: false }
      ]
    },
    orderBy: [
      { priority: 'desc' },
      { createdAt: 'asc' }
    ]
  })

  // If no pages found, check for 'completed' pages that might have unprocessed citations
  // (This handles the case where pages were incorrectly marked as complete)
  if (!page) {
    const { prisma: prismaClient } = await import('@/lib/prisma')
    
    // Find completed pages that have citations with scanStatus != 'scanned' or relevanceDecision = null
    const pagesWithUnprocessedCitations = await prismaClient.wikipediaMonitoring.findMany({
      where: {
        patchId,
        status: 'completed',
        citationsExtracted: true,
        citations: {
          some: {
            OR: [
              { scanStatus: { not: 'scanned' } },
              { relevanceDecision: null }
            ]
          }
        }
      },
      select: {
        id: true,
        wikipediaUrl: true,
        wikipediaTitle: true,
        priority: true,
        createdAt: true
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' }
      ],
      take: 1
    })

    if (pagesWithUnprocessedCitations.length > 0) {
      const foundPage = pagesWithUnprocessedCitations[0]
      console.log(`[WikipediaMonitoring] Found 'completed' page with unprocessed citations: ${foundPage.wikipediaTitle}. Resetting to 'scanning' status.`)
      
      // Reset status to 'scanning' so it can be processed
      await prismaClient.wikipediaMonitoring.update({
        where: { id: foundPage.id },
        data: { status: 'scanning' }
      })
      
      page = {
        id: foundPage.id,
        url: foundPage.wikipediaUrl,
        title: foundPage.wikipediaTitle
      } as any
    }
  }

  if (!page) {
    // Enhanced diagnostic logging to understand why no pages are found
    const allPages = await prisma.wikipediaMonitoring.findMany({
      where: { patchId },
      select: { 
        id: true, 
        status: true, 
        contentScanned: true, 
        citationsExtracted: true,
        wikipediaTitle: true
      }
    })
    
    const statusCounts = allPages.reduce((acc, p) => {
      acc[p.status] = (acc[p.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const extractionBreakdown = allPages.reduce((acc, p) => {
      const key = `contentScanned:${p.contentScanned},citationsExtracted:${p.citationsExtracted}`
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    console.log(`[WikipediaMonitoring] No pages available to process for patch ${patchId}`)
    console.log(`[WikipediaMonitoring] Status breakdown:`, statusCounts)
    console.log(`[WikipediaMonitoring] Extraction breakdown:`, extractionBreakdown)
    console.log(`[WikipediaMonitoring] Query conditions: status IN ['pending','scanning','error'] AND (contentScanned=false OR citationsExtracted=false)`)

    // Show sample pages to understand their state
    if (allPages.length > 0) {
      console.log(`[WikipediaMonitoring] Sample pages (first 5):`)
      allPages.slice(0, 5).forEach((p, i) => {
        console.log(`  ${i + 1}. "${p.wikipediaTitle}" - status: ${p.status}, contentScanned: ${p.contentScanned}, citationsExtracted: ${p.citationsExtracted}`)
      })
    }

    return null
  }

  return {
    id: page.id,
    url: page.wikipediaUrl,
    title: page.wikipediaTitle
  }
}

/**
 * Mark Wikipedia page as being scanned
 */
export async function markWikipediaPageScanning(
  monitoringId: string
): Promise<void> {
  await prisma.wikipediaMonitoring.update({
    where: { id: monitoringId },
    data: {
      status: 'scanning',
      lastScannedAt: new Date()
    }
  })
}

/**
 * Update Wikipedia page with scanned content
 */
export async function updateWikipediaPageContent(
  monitoringId: string,
  contentText: string
): Promise<void> {
  await prisma.wikipediaMonitoring.update({
    where: { id: monitoringId },
    data: {
      contentScanned: true,
      contentText,
      lastScannedAt: new Date()
    }
  })
}

/**
 * Mark Wikipedia page citations as extracted
 * NOTE: Does NOT mark page as 'completed' - that only happens after ALL citations are processed
 */
export async function markCitationsExtracted(
  monitoringId: string,
  citationCount: number
): Promise<void> {
  await prisma.wikipediaMonitoring.update({
    where: { id: monitoringId },
    data: {
      citationsExtracted: true,
      citationCount,
      lastExtractedAt: new Date()
      // DO NOT set status: 'completed' here - wait until all citations are processed
      // Status will be set to 'completed' by checkAndMarkPageCompleteIfAllCitationsProcessed
    }
  })
}

/**
 * Mark Wikipedia page processing as complete
 */
export async function markWikipediaPageComplete(
  monitoringId: string
): Promise<void> {
  await prisma.wikipediaMonitoring.update({
    where: { id: monitoringId },
    data: {
      status: 'completed'
    }
  })
}

/**
 * Mark Wikipedia page processing as error
 */
export async function markWikipediaPageError(
  monitoringId: string,
  errorMessage: string
): Promise<void> {
  await prisma.wikipediaMonitoring.update({
    where: { id: monitoringId },
    data: {
      status: 'error',
      errorMessage
    }
  })
}

/**
 * Get monitoring statistics for a patch
 */
export async function getWikipediaMonitoringStats(
  patchId: string
): Promise<{
  totalPages: number
  scannedPages: number
  pagesWithCitations: number
  totalCitations: number
  processedCitations: number
}> {
  const [totalPages, scannedPages, pagesWithCitations, citations] = await Promise.all([
    prisma.wikipediaMonitoring.count({ where: { patchId } }),
    prisma.wikipediaMonitoring.count({ where: { patchId, contentScanned: true } }),
    prisma.wikipediaMonitoring.count({ where: { patchId, citationsExtracted: true } }),
    prisma.wikipediaCitation.count({
      where: {
        monitoring: { patchId }
      }
    })
  ])

  const processedCitations = await prisma.wikipediaCitation.count({
    where: {
      monitoring: { patchId },
      scanStatus: 'scanned'
    }
  })

  return {
    totalPages,
    scannedPages,
    pagesWithCitations,
    totalCitations: citations,
    processedCitations
  }
}

