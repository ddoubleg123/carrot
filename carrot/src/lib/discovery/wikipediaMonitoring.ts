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
 * Add a Wikipedia page to monitoring if it doesn't already exist
 * Used when a relevant Wikipedia link is found in citations
 */
export async function addWikipediaPageToMonitoring(
  patchId: string,
  wikipediaUrl: string,
  wikipediaTitle: string,
  source: string = 'citation' // How this page was discovered
): Promise<{ added: boolean; monitoringId?: string }> {
  try {
    const canonical = canonicalizeUrlFast(wikipediaUrl)
    if (!canonical) {
      return { added: false }
    }

    // Check if already exists
    const existing = await prisma.wikipediaMonitoring.findUnique({
      where: {
        patchId_wikipediaUrl: {
          patchId,
          wikipediaUrl: canonical
        }
      }
    })

    if (existing) {
      console.log(`[WikipediaMonitoring] Page already monitored: ${wikipediaTitle}`)
      return { added: false, monitoringId: existing.id }
    }

    // Create new monitoring entry
    const newPage = await prisma.wikipediaMonitoring.create({
      data: {
        patchId,
        wikipediaUrl: canonical,
        wikipediaTitle,
        searchTerm: source, // Track how this page was discovered
        priority: 5, // Medium priority for discovered pages
        status: 'pending'
      }
    })

    console.log(`[WikipediaMonitoring] Added new page to monitoring: ${wikipediaTitle} (from ${source})`)
    
    // Immediately extract and store citations from this Wikipedia page
    // This ensures we capture all reference URLs and sources just like we do with all Wikipedia pages
    try {
      console.log(`[WikipediaMonitoring] Extracting citations from newly added page: ${wikipediaTitle}`)
      const { extractAndStoreCitations } = await import('./wikipediaCitation')
      const { prioritizeCitations } = await import('./wikipediaProcessor')
      
      // Fetch the Wikipedia page HTML
      const response = await fetch(canonical, {
        headers: {
          'User-Agent': 'CarrotApp/1.0 (Educational research platform)'
        }
      })
      
      if (response.ok) {
        const html = await response.text()
        
        // Extract and store citations (this will be processed incrementally later)
        // Create a wrapper function that matches the expected signature
        const prioritizeFn = async (citations: any[], sourceUrl: string) => {
          // Get patch info for topic/aliases
          const patch = await prisma.patch.findUnique({
            where: { id: patchId },
            select: { title: true, tags: true }
          })
          const topic = patch?.title || 'unknown'
          const aliases = (patch?.tags as string[]) || []
          return prioritizeCitations(citations, sourceUrl, topic, aliases)
        }
        
        await extractAndStoreCitations(
          newPage.id,
          canonical,
          html,
          prioritizeFn
        )
        
        console.log(`[WikipediaMonitoring] ✅ Citations extracted from ${wikipediaTitle}`)
      } else {
        console.warn(`[WikipediaMonitoring] Failed to fetch HTML for citation extraction: ${wikipediaTitle} (HTTP ${response.status})`)
      }
    } catch (error) {
      // Non-fatal - citations can be extracted later during incremental processing
      console.warn(`[WikipediaMonitoring] Error extracting citations from ${wikipediaTitle}:`, error)
    }
    
    return { added: true, monitoringId: newPage.id }
  } catch (error) {
    console.error(`[WikipediaMonitoring] Error adding page "${wikipediaTitle}":`, error)
    return { added: false }
  }
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
    select: {
      id: true,
      wikipediaUrl: true,
      wikipediaTitle: true
    },
    orderBy: [
      { priority: 'desc' },
      { createdAt: 'asc' }
    ]
  })
  
  // Convert to expected format
  if (page) {
    page = {
      id: page.id,
      url: page.wikipediaUrl,
      title: page.wikipediaTitle || ''
    } as any
  }

  // If no pages found, check for 'completed' pages that might have unprocessed citations
  // (This handles the case where pages were incorrectly marked as complete)
  if (!page) {
    const { prisma: prismaClient } = await import('@/lib/prisma')
    
    // Find completed pages that have unprocessed citations
    // A citation is unprocessed if it's NOT scanned AND verification didn't fail
    const pagesWithUnprocessedCitations = await prismaClient.wikipediaMonitoring.findMany({
      where: {
        patchId,
        status: 'completed',
        citationsExtracted: true,
        citations: {
          some: {
            AND: [
              { scanStatus: { not: 'scanned' } }, // Not scanned
              { verificationStatus: { not: 'failed' } } // And verification didn't fail
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

