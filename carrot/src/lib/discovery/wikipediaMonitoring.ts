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
  return { pagesFound: foundPages.size, pagesStored }
}

/**
 * Get next Wikipedia page to process (for incremental processing)
 */
export async function getNextWikipediaPageToProcess(
  patchId: string
): Promise<{ id: string; url: string; title: string } | null> {
  const page = await prisma.wikipediaMonitoring.findFirst({
    where: {
      patchId,
      status: { in: ['pending', 'scanning'] },
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

  if (!page) return null

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
      lastExtractedAt: new Date(),
      status: 'completed'
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

