/**
 * Self-Audit Verification Function
 * Verifies that all external URLs from each Wikipedia page are accounted for and working
 */

import { prisma } from '@/lib/prisma'
import { extractAllExternalUrls } from './wikiUtils'

export interface AuditResult {
  wikipediaPage: string
  wikipediaUrl: string
  totalExternalUrls: number
  foundInDatabase: number
  missingFromDatabase: number
  statusBreakdown: {
    pending: number
    verified: number
    failed: number
    saved: number
    denied: number
  }
  missingUrls: string[]
  discrepancies: Array<{
    url: string
    expectedStatus: string
    actualStatus: string
  }>
}

/**
 * Audit Wikipedia page references - self-verification
 * Fetches Wikipedia page, extracts all external URLs, checks database, verifies status
 */
export async function auditWikipediaPageReferences(
  patchId: string,
  wikipediaTitle: string
): Promise<AuditResult> {
  // 1. Fetch Wikipedia page
  const wikipediaUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(wikipediaTitle)}`
  const response = await fetch(wikipediaUrl, {
    headers: {
      'User-Agent': 'CarrotBot/1.0 (https://carrot-app.onrender.com)',
      'Accept': 'text/html,application/xhtml+xml'
    }
  })
  
  if (!response.ok) {
    throw new Error(`Failed to fetch Wikipedia page: ${response.status}`)
  }
  
  const html = await response.text()
  
  // 2. Extract all external URLs (not Wikipedia internal)
  // Note: extractAllExternalUrls now properly filters Wikipedia links
  const externalUrls = extractAllExternalUrls(html, wikipediaUrl)
  const totalExternalUrls = externalUrls.length
  
  // Verify that no Wikipedia URLs are included
  const wikipediaUrlsInResults = externalUrls.filter(u => {
    const url = u.url
    return url.includes('wikipedia.org') || url.includes('wikimedia.org') || url.includes('wikidata.org') ||
           url.startsWith('./') || url.startsWith('/wiki/')
  })
  
  if (wikipediaUrlsInResults.length > 0) {
    console.warn(`[Audit] Warning: ${wikipediaUrlsInResults.length} Wikipedia URLs found in external URLs list - this should not happen`)
  }
  
  // 3. Get monitoring entry for this page
  const monitoring = await prisma.wikipediaMonitoring.findFirst({
    where: {
      patchId,
      wikipediaTitle
    },
    include: {
      citations: {
        select: {
          citationUrl: true,
          verificationStatus: true,
          scanStatus: true,
          relevanceDecision: true,
          savedContentId: true
        }
      }
    }
  })
  
  if (!monitoring) {
    return {
      wikipediaPage: wikipediaTitle,
      wikipediaUrl,
      totalExternalUrls,
      foundInDatabase: 0,
      missingFromDatabase: totalExternalUrls,
      statusBreakdown: {
        pending: 0,
        verified: 0,
        failed: 0,
        saved: 0,
        denied: 0
      },
      missingUrls: externalUrls.map(u => u.url),
      discrepancies: []
    }
  }
  
  // 4. Check each external URL against database
  const dbUrls = new Map(
    monitoring.citations.map(c => [c.citationUrl, c])
  )
  
  const foundInDatabase = externalUrls.filter(u => dbUrls.has(u.url)).length
  const missingFromDatabase = totalExternalUrls - foundInDatabase
  const missingUrls = externalUrls
    .filter(u => !dbUrls.has(u.url))
    .map(u => u.url)
  
  // 5. Status breakdown
  const statusBreakdown = {
    pending: monitoring.citations.filter(c => c.verificationStatus === 'pending').length,
    verified: monitoring.citations.filter(c => c.verificationStatus === 'verified').length,
    failed: monitoring.citations.filter(c => c.verificationStatus === 'failed').length,
    saved: monitoring.citations.filter(c => c.savedContentId).length,
    denied: monitoring.citations.filter(c => c.relevanceDecision === 'denied').length
  }
  
  // 6. Find discrepancies (URLs that should be in DB but aren't, or have wrong status)
  const discrepancies: Array<{ url: string; expectedStatus: string; actualStatus: string }> = []
  
  for (const extUrl of externalUrls) {
    const dbCitation = dbUrls.get(extUrl.url)
    if (!dbCitation) {
      discrepancies.push({
        url: extUrl.url,
        expectedStatus: 'should_exist',
        actualStatus: 'missing'
      })
    }
  }
  
  return {
    wikipediaPage: wikipediaTitle,
    wikipediaUrl,
    totalExternalUrls,
    foundInDatabase,
    missingFromDatabase,
    statusBreakdown,
    missingUrls,
    discrepancies
  }
}

