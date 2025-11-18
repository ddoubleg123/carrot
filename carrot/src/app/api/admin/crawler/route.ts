/**
 * Admin dashboard for crawler
 * GET /api/admin/crawler
 * Shows metrics, last 50 crawl attempts, top domains, etc.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getDiscoveryQueueDepth, getExtractionQueueDepth } from '@/lib/crawler/queues'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    // Get last 50 pages
    const pages = await prisma.crawlerPage.findMany({
      orderBy: { firstSeenAt: 'desc' },
      take: 50,
      select: {
        id: true,
        url: true,
        domain: true,
        status: true,
        httpStatus: true,
        reasonCode: true,
        extractedText: true,
        firstSeenAt: true,
        lastProcessedAt: true,
      },
    })
    
    // Get recent extractions (for sparkline)
    const extractions = await prisma.crawlerExtraction.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        createdAt: true,
        topic: true,
      },
    })
    
    // Calculate statistics
    const totalPages = pages.length
    const fetched = pages.filter(p => p.status === 'fetched').length
    const failed = pages.filter(p => p.status === 'failed').length
    const extracted = pages.filter(p => p.status === 'extracted').length
    
    const wikiPages = pages.filter(p => p.domain?.includes('wikipedia.org')).length
    const nonWikiPages = totalPages - wikiPages
    const wikiPercent = totalPages > 0 ? (wikiPages / totalPages) * 100 : 0
    
    const shortText = pages.filter(p => (p.extractedText?.length || 0) < 500).length
    const shortTextPercent = totalPages > 0 ? (shortText / totalPages) * 100 : 0
    
    // Reason code counts
    const reasonCounts: Record<string, number> = {}
    pages.forEach(p => {
      if (p.reasonCode) {
        reasonCounts[p.reasonCode] = (reasonCounts[p.reasonCode] || 0) + 1
      }
    })
    
    // Domain counts
    const domainCounts: Record<string, number> = {}
    pages.forEach(p => {
      if (p.domain) {
        domainCounts[p.domain] = (domainCounts[p.domain] || 0) + 1
      }
    })
    
    // Top domains
    const topDomains = Object.entries(domainCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([domain, count]) => ({ domain, count }))
    
    // Top failure reasons
    const topFailures = Object.entries(reasonCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([reason, count]) => ({ reason, count }))
    
    // Extraction sparkline (last 24 hours, hourly buckets)
    const now = Date.now()
    const sparklineData: number[] = []
    for (let i = 23; i >= 0; i--) {
      const hourStart = new Date(now - (i + 1) * 60 * 60 * 1000)
      const hourEnd = new Date(now - i * 60 * 60 * 1000)
      const count = extractions.filter(e => {
        const ts = new Date(e.createdAt).getTime()
        return ts >= hourStart.getTime() && ts < hourEnd.getTime()
      }).length
      sparklineData.push(count)
    }
    
    // Queue depths
    const discoveryDepth = await getDiscoveryQueueDepth().catch(() => -1)
    const extractionDepth = await getExtractionQueueDepth().catch(() => -1)
    
    return NextResponse.json({
      summary: {
        totalPages,
        fetched,
        failed,
        extracted,
        extractionRate: totalPages > 0 ? (extracted / totalPages) * 100 : 0,
      },
      distribution: {
        wiki: { count: wikiPages, percent: wikiPercent },
        nonWiki: { count: nonWikiPages, percent: 100 - wikiPercent },
        shortText: { count: shortText, percent: shortTextPercent },
      },
      topDomains,
      topFailures,
      sparkline: {
        extraction_ok: sparklineData,
        labels: Array.from({ length: 24 }, (_, i) => {
          const hour = new Date(now - (23 - i) * 60 * 60 * 1000)
          return hour.toISOString().slice(11, 13) + ':00'
        }),
      },
      queues: {
        discovery: discoveryDepth,
        extraction: extractionDepth,
      },
      last50: pages.map(p => ({
        id: p.id,
        url: p.url?.slice(0, 100),
        domain: p.domain,
        status: p.status,
        httpStatus: p.httpStatus,
        reasonCode: p.reasonCode,
        textLen: p.extractedText?.length || 0,
        firstSeenAt: p.firstSeenAt.toISOString(),
      })),
    })
  } catch (error: any) {
    console.error('[Admin Crawler] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

