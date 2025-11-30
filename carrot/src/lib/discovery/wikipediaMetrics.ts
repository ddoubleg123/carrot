/**
 * Wikipedia Monitoring Metrics and Status Tracking
 * Provides visibility into Wikipedia search and processing status
 */

import { prisma } from '@/lib/prisma'

export interface WikipediaMonitoringStatus {
  patchId: string
  totalPages: number
  scannedPages: number
  pagesWithCitations: number
  totalCitations: number
  processedCitations: number
  savedCitations: number
  deniedCitations: number
  pendingCitations: number
  lastProcessedAt: Date | null
  averagePriorityScore: number | null
}

/**
 * Get comprehensive status of Wikipedia monitoring for a patch
 */
export async function getWikipediaMonitoringStatus(
  patchId: string
): Promise<WikipediaMonitoringStatus> {
  const [monitoring, citations] = await Promise.all([
    prisma.wikipediaMonitoring.findMany({
      where: { patchId },
      select: {
        id: true,
        contentScanned: true,
        citationsExtracted: true,
        lastScannedAt: true,
        lastExtractedAt: true
      }
    }),
    prisma.wikipediaCitation.findMany({
      where: {
        monitoring: { patchId }
      },
      select: {
        id: true,
        scanStatus: true,
        relevanceDecision: true,
        aiPriorityScore: true,
        lastScannedAt: true
      }
    })
  ])

  const scannedPages = monitoring.filter(m => m.contentScanned).length
  const pagesWithCitations = monitoring.filter(m => m.citationsExtracted).length
  const processedCitations = citations.filter(c => c.scanStatus === 'scanned').length
  const savedCitations = citations.filter(c => c.relevanceDecision === 'saved').length
  const deniedCitations = citations.filter(c => c.relevanceDecision === 'denied').length
  const pendingCitations = citations.filter(c => c.scanStatus === 'not_scanned').length

  const scores = citations
    .map(c => c.aiPriorityScore)
    .filter((s): s is number => s !== null)
  const averagePriorityScore = scores.length > 0
    ? scores.reduce((a, b) => a + b, 0) / scores.length
    : null

  const lastProcessedAt = citations
    .map(c => c.lastScannedAt)
    .filter((d): d is Date => d !== null)
    .sort((a, b) => b.getTime() - a.getTime())[0] || null

  return {
    patchId,
    totalPages: monitoring.length,
    scannedPages,
    pagesWithCitations,
    totalCitations: citations.length,
    processedCitations,
    savedCitations,
    deniedCitations,
    pendingCitations,
    lastProcessedAt,
    averagePriorityScore
  }
}

/**
 * Get processing progress percentage
 */
export async function getWikipediaProcessingProgress(
  patchId: string
): Promise<{
  pagesProgress: number // 0-100
  citationsProgress: number // 0-100
  overallProgress: number // 0-100
}> {
  const status = await getWikipediaMonitoringStatus(patchId)

  const pagesProgress = status.totalPages > 0
    ? (status.scannedPages / status.totalPages) * 100
    : 0

  const citationsProgress = status.totalCitations > 0
    ? (status.processedCitations / status.totalCitations) * 100
    : 0

  // Overall progress: 50% pages + 50% citations
  const overallProgress = (pagesProgress * 0.5) + (citationsProgress * 0.5)

  return {
    pagesProgress: Math.round(pagesProgress),
    citationsProgress: Math.round(citationsProgress),
    overallProgress: Math.round(overallProgress)
  }
}

/**
 * Get top priority citations awaiting processing
 */
export async function getTopPriorityCitations(
  patchId: string,
  limit: number = 10
): Promise<Array<{
  id: string
  url: string
  title: string | null
  priorityScore: number | null
  sourceNumber: number
  status: string
}>> {
  const citations = await prisma.wikipediaCitation.findMany({
    where: {
      monitoring: { patchId },
      scanStatus: { in: ['not_scanned', 'scanning'] },
      relevanceDecision: null
    },
    orderBy: [
      { aiPriorityScore: 'desc' },
      { createdAt: 'asc' }
    ],
    take: limit,
    select: {
      id: true,
      citationUrl: true,
      citationTitle: true,
      aiPriorityScore: true,
      sourceNumber: true,
      scanStatus: true
    }
  })

  return citations.map(c => ({
    id: c.id,
    url: c.citationUrl,
    title: c.citationTitle,
    priorityScore: c.aiPriorityScore,
    sourceNumber: c.sourceNumber,
    status: c.scanStatus
  }))
}

