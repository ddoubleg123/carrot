/**
 * Audit Discovery Run
 * 
 * Comprehensive audit of discovery process for a patch:
 * - Citation processing patterns (duplicates, methodical processing)
 * - Wikipedia deep link extraction
 * - Anna's Archive extraction
 * - News source extraction
 * - Overall KPIs and metrics
 */

import prisma from '@/lib/prisma'
import { getSaveCounters, frontierSize } from '@/lib/redis/discovery'

interface AuditResult {
  timestamp: string
  patchHandle: string
  patchId: string
  
  // Run Status
  activeRuns: Array<{
    id: string
    status: string
    startedAt: Date
    metrics: any
  }>
  
  // Citation Processing
  citations: {
    total: number
    processed: number
    saved: number
    denied: number
    pending: number
    duplicateCheck: {
      total: number
      uniqueUrls: number
      duplicateRate: number
      recentDuplicates: Array<{ url: string; count: number }>
    }
    processingPattern: {
      lastProcessedAt: Date | null
      averageProcessingTime: number | null
      itemsProcessedToday: number
      itemsProcessedThisHour: number
    }
  }
  
  // Wikipedia Deep Links
  wikipedia: {
    pagesMonitored: number
    citationsExtracted: number
    deepLinksExtracted: number
    outlinksExtracted: number
    internalLinksExtracted: number
    extractionSuccessRate: number
    recentExtractions: Array<{
      url: string
      extractedAt: Date
      type: 'citation' | 'outlink' | 'internal'
    }>
  }
  
  // Anna's Archive
  annasArchive: {
    totalSeeds: number
    processed: number
    extracted: number
    failed: number
    successRate: number
    recentExtractions: Array<{
      url: string
      title: string
      extractedAt: Date
      contentLength: number
    }>
  }
  
  // News Sources
  news: {
    totalProcessed: number
    saved: number
    failed: number
    successRate: number
    sources: Array<{
      domain: string
      count: number
    }>
  }
  
  // Overall Discovery Metrics
  discovery: {
    totalDiscovered: number
    itemsSaved: number
    itemsProcessed: number
    saveRate: number
    frontierSize: number
    recentItems: Array<{
      id: string
      title: string
      url: string
      source: string
      createdAt: Date
    }>
  }
  
  // KPIs
  kpis: {
    citationProcessingRate: number // citations processed per hour
    extractionSuccessRate: number // successful extractions / total attempts
    duplicatePreventionRate: number // duplicates caught / total processed
    sourceDiversity: number // unique domains / total items
    timeToFirstSave: number | null // minutes from run start to first save
    averageProcessingTime: number | null // average time per item
  }
}

async function auditDiscoveryRun(patchHandle: string): Promise<AuditResult> {
  console.log(`\n🔍 Starting comprehensive discovery audit for: ${patchHandle}\n`)
  
  // Get patch
  const patch = await prisma.patch.findUnique({
    where: { handle: patchHandle },
    select: { id: true, title: true }
  })
  
  if (!patch) {
    throw new Error(`Patch not found: ${patchHandle}`)
  }
  
  const patchId = patch.id
  const now = new Date()
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  
  // Get active runs
  const activeRuns = await (prisma as any).discoveryRun.findMany({
    where: {
      patchId,
      status: { in: ['live', 'queued'] }
    },
    orderBy: { startedAt: 'desc' },
    take: 5,
    select: {
      id: true,
      status: true,
      startedAt: true,
      metrics: true
    }
  })
  
  // Citation Processing Audit
  const totalCitations = await prisma.wikipediaCitation.count({
    where: {
      monitoring: { patchId }
    }
  })
  
  const processedCitations = await prisma.wikipediaCitation.count({
    where: {
      monitoring: { patchId },
      scanStatus: 'scanned'
    }
  })
  
  const savedCitations = await prisma.wikipediaCitation.count({
    where: {
      monitoring: { patchId },
      relevanceDecision: 'saved'
    }
  })
  
  const deniedCitations = await prisma.wikipediaCitation.count({
    where: {
      monitoring: { patchId },
      relevanceDecision: 'denied'
    }
  })
  
  const pendingCitations = await prisma.wikipediaCitation.count({
    where: {
      monitoring: { patchId },
      OR: [
        { scanStatus: 'not_scanned' },
        { scanStatus: 'scanning' },
        { scanStatus: 'scanned', relevanceDecision: null }
      ]
    }
  })
  
  // Check for duplicate processing
  const citationUrls = await prisma.wikipediaCitation.findMany({
    where: {
      monitoring: { patchId },
      scanStatus: 'scanned'
    },
    select: {
      citationUrl: true,
      lastScannedAt: true
    },
    orderBy: { lastScannedAt: 'desc' },
    take: 1000
  })
  
  const urlCounts = new Map<string, number>()
  citationUrls.forEach(c => {
    urlCounts.set(c.citationUrl, (urlCounts.get(c.citationUrl) || 0) + 1)
  })
  
  const duplicates = Array.from(urlCounts.entries())
    .filter(([_, count]) => count > 1)
    .map(([url, count]) => ({ url, count }))
    .slice(0, 10)
  
  // Wikipedia Deep Links
  const wikipediaPages = await prisma.wikipediaMonitoring.count({
    where: { patchId }
  })
  
  const wikipediaCitations = await prisma.wikipediaCitation.count({
    where: {
      monitoring: { patchId }
    }
  })
  
  // Check discovered content for Wikipedia outlinks
  const wikipediaOutlinks = await prisma.discoveredContent.count({
    where: {
      patchId,
      metadata: {
        path: ['source'],
        equals: 'wikipedia_outlink'
      }
    }
  })
  
  const wikipediaInternalLinks = await prisma.discoveredContent.count({
    where: {
      patchId,
      metadata: {
        path: ['source'],
        equals: 'wikipedia_internal'
      }
    }
  })
  
  // Anna's Archive Audit
  const annasArchiveSeeds = await prisma.discoveredContent.findMany({
    where: {
      patchId,
      OR: [
        { sourceUrl: { contains: 'annas-archive.org' } },
        { metadata: { path: ['source'], equals: "Anna's Archive" } }
      ]
    },
    select: {
      id: true,
      title: true,
      sourceUrl: true,
      textContent: true,
      createdAt: true,
      metadata: true
    },
    orderBy: { createdAt: 'desc' },
    take: 50
  })
  
  const annasArchiveExtracted = annasArchiveSeeds.filter(item => 
    item.textContent && item.textContent.length > 100
  )
  
  // News Sources Audit
  const newsItems = await prisma.discoveredContent.findMany({
    where: {
      patchId,
      category: { in: ['news', 'article'] },
      createdAt: { gte: oneDayAgo }
    },
    select: {
      id: true,
      domain: true,
      sourceDomain: true,
      createdAt: true
    }
  })
  
  const newsDomains = new Map<string, number>()
  newsItems.forEach(item => {
    const domain = item.domain || item.sourceDomain || 'unknown'
    newsDomains.set(domain, (newsDomains.get(domain) || 0) + 1)
  })
  
  // Overall Discovery Metrics
  const totalDiscovered = await prisma.discoveredContent.count({
    where: { patchId }
  })
  
  const recentItems = await prisma.discoveredContent.findMany({
    where: { patchId },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      id: true,
      title: true,
      sourceUrl: true,
      category: true,
      createdAt: true,
      metadata: true
    }
  })
  
  // Get Redis counters
  let redisCounters
  let frontierSizeCount = 0
  try {
    redisCounters = await getSaveCounters(patchId)
    frontierSizeCount = await frontierSize(patchId).catch(() => 0)
  } catch (err) {
    console.warn('Failed to get Redis counters:', err)
    redisCounters = { total: 0, controversy: 0, history: 0 }
  }
  
  // Calculate processing times
  const citationsWithTiming = await prisma.wikipediaCitation.findMany({
    where: {
      monitoring: { patchId },
      scanStatus: 'scanned',
      lastScannedAt: { not: null }
    },
    select: {
      lastScannedAt: true,
      createdAt: true
    },
    take: 100
  })
  
  const processingTimes = citationsWithTiming
    .filter(c => c.lastScannedAt && c.createdAt)
    .map(c => {
      const scanned = new Date(c.lastScannedAt!)
      const created = new Date(c.createdAt)
      return (scanned.getTime() - created.getTime()) / 1000 / 60 // minutes
    })
  
  const averageProcessingTime = processingTimes.length > 0
    ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length
    : null
  
  // Get first save time
  const firstSave = await prisma.discoveredContent.findFirst({
    where: { patchId },
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true }
  })
  
  const firstRun = activeRuns[0]
  const timeToFirstSave = firstRun && firstSave
    ? (firstSave.createdAt.getTime() - new Date(firstRun.startedAt).getTime()) / 1000 / 60
    : null
  
  // Build audit result
  const result: AuditResult = {
    timestamp: now.toISOString(),
    patchHandle,
    patchId,
    
    activeRuns: activeRuns.map((r: any) => ({
      id: r.id,
      status: r.status,
      startedAt: r.startedAt,
      metrics: r.metrics
    })),
    
    citations: {
      total: totalCitations,
      processed: processedCitations,
      saved: savedCitations,
      denied: deniedCitations,
      pending: pendingCitations,
      duplicateCheck: {
        total: citationUrls.length,
        uniqueUrls: urlCounts.size,
        duplicateRate: citationUrls.length > 0 ? duplicates.length / citationUrls.length : 0,
        recentDuplicates: duplicates
      },
      processingPattern: {
        lastProcessedAt: citationUrls[0]?.lastScannedAt || null,
        averageProcessingTime,
        itemsProcessedToday: await prisma.wikipediaCitation.count({
          where: {
            monitoring: { patchId },
            scanStatus: 'scanned',
            lastScannedAt: { gte: oneDayAgo }
          }
        }),
        itemsProcessedThisHour: await prisma.wikipediaCitation.count({
          where: {
            monitoring: { patchId },
            scanStatus: 'scanned',
            lastScannedAt: { gte: oneHourAgo }
          }
        })
      }
    },
    
    wikipedia: {
      pagesMonitored: wikipediaPages,
      citationsExtracted: wikipediaCitations,
      deepLinksExtracted: wikipediaOutlinks,
      outlinksExtracted: wikipediaOutlinks,
      internalLinksExtracted: wikipediaInternalLinks,
      extractionSuccessRate: wikipediaCitations > 0 
        ? (savedCitations / wikipediaCitations) * 100 
        : 0,
      recentExtractions: recentItems
        .filter(item => item.sourceUrl?.includes('wikipedia.org'))
        .slice(0, 10)
        .map(item => ({
          url: item.sourceUrl || '',
          extractedAt: item.createdAt,
          type: 'citation' as const
        }))
    },
    
    annasArchive: {
      totalSeeds: annasArchiveSeeds.length,
      processed: annasArchiveSeeds.length,
      extracted: annasArchiveExtracted.length,
      failed: annasArchiveSeeds.length - annasArchiveExtracted.length,
      successRate: annasArchiveSeeds.length > 0
        ? (annasArchiveExtracted.length / annasArchiveSeeds.length) * 100
        : 0,
      recentExtractions: annasArchiveExtracted.slice(0, 10).map(item => ({
        url: item.sourceUrl || '',
        title: item.title || 'Untitled',
        extractedAt: item.createdAt,
        contentLength: item.textContent?.length || 0
      }))
    },
    
    news: {
      totalProcessed: newsItems.length,
      saved: newsItems.length,
      failed: 0,
      successRate: 100,
      sources: Array.from(newsDomains.entries())
        .map(([domain, count]) => ({ domain, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
    },
    
    discovery: {
      totalDiscovered,
      itemsSaved: redisCounters.total || totalDiscovered,
      itemsProcessed: processedCitations + newsItems.length,
      saveRate: (redisCounters.total || totalDiscovered) / Math.max(processedCitations + newsItems.length, 1) * 100,
      frontierSize: frontierSizeCount,
      recentItems: recentItems.map(item => ({
        id: item.id,
        title: item.title || 'Untitled',
        url: item.sourceUrl || '',
        source: (item.metadata as any)?.source || item.category || 'unknown',
        createdAt: item.createdAt
      }))
    },
    
    kpis: {
    citationProcessingRate: await prisma.wikipediaCitation.count({
      where: {
        monitoring: { patchId },
        scanStatus: 'scanned',
        lastScannedAt: { gte: oneHourAgo }
      }
    }),
      extractionSuccessRate: (savedCitations + annasArchiveExtracted.length) / Math.max(processedCitations + annasArchiveSeeds.length, 1) * 100,
      duplicatePreventionRate: duplicates.length > 0 ? (duplicates.length / citationUrls.length) * 100 : 0,
      sourceDiversity: newsDomains.size / Math.max(newsItems.length, 1) * 100,
      timeToFirstSave,
      averageProcessingTime
    }
  }
  
  return result
}

// Main execution
async function main() {
  const patchHandle = process.argv[2] || 'israel'
  
  try {
    const audit = await auditDiscoveryRun(patchHandle)
    
    console.log('\n' + '='.repeat(80))
    console.log('📊 DISCOVERY AUDIT REPORT')
    console.log('='.repeat(80))
    console.log(`\nPatch: ${audit.patchHandle} (${audit.patchId})`)
    console.log(`Timestamp: ${audit.timestamp}`)
    console.log(`Active Runs: ${audit.activeRuns.length}`)
    
    console.log('\n' + '-'.repeat(80))
    console.log('📚 CITATION PROCESSING')
    console.log('-'.repeat(80))
    console.log(`Total Citations: ${audit.citations.total.toLocaleString()}`)
    console.log(`Processed: ${audit.citations.processed.toLocaleString()} (${(audit.citations.processed / Math.max(audit.citations.total, 1) * 100).toFixed(1)}%)`)
    console.log(`Saved: ${audit.citations.saved.toLocaleString()}`)
    console.log(`Denied: ${audit.citations.denied.toLocaleString()}`)
    console.log(`Pending: ${audit.citations.pending.toLocaleString()}`)
    console.log(`\nDuplicate Check:`)
    console.log(`  Unique URLs: ${audit.citations.duplicateCheck.uniqueUrls.toLocaleString()}`)
    console.log(`  Duplicate Rate: ${(audit.citations.duplicateCheck.duplicateRate * 100).toFixed(2)}%`)
    if (audit.citations.duplicateCheck.recentDuplicates.length > 0) {
      console.log(`  Recent Duplicates:`)
      audit.citations.duplicateCheck.recentDuplicates.forEach(dup => {
        console.log(`    - ${dup.url.substring(0, 60)}... (${dup.count}x)`)
      })
    }
    console.log(`\nProcessing Pattern:`)
    console.log(`  Processed Today: ${audit.citations.processingPattern.itemsProcessedToday}`)
    console.log(`  Processed This Hour: ${audit.citations.processingPattern.itemsProcessedThisHour}`)
    console.log(`  Average Processing Time: ${audit.citations.processingPattern.averageProcessingTime?.toFixed(2) || 'N/A'} minutes`)
    
    console.log('\n' + '-'.repeat(80))
    console.log('🌐 WIKIPEDIA DEEP LINKS')
    console.log('-'.repeat(80))
    console.log(`Pages Monitored: ${audit.wikipedia.pagesMonitored}`)
    console.log(`Citations Extracted: ${audit.wikipedia.citationsExtracted.toLocaleString()}`)
    console.log(`Outlinks Extracted: ${audit.wikipedia.outlinksExtracted.toLocaleString()}`)
    console.log(`Internal Links Extracted: ${audit.wikipedia.internalLinksExtracted.toLocaleString()}`)
    console.log(`Extraction Success Rate: ${audit.wikipedia.extractionSuccessRate.toFixed(1)}%`)
    
    console.log('\n' + '-'.repeat(80))
    console.log('📖 ANNA\'S ARCHIVE')
    console.log('-'.repeat(80))
    console.log(`Total Seeds: ${audit.annasArchive.totalSeeds}`)
    console.log(`Processed: ${audit.annasArchive.processed}`)
    console.log(`Successfully Extracted: ${audit.annasArchive.extracted}`)
    console.log(`Failed: ${audit.annasArchive.failed}`)
    console.log(`Success Rate: ${audit.annasArchive.successRate.toFixed(1)}%`)
    if (audit.annasArchive.recentExtractions.length > 0) {
      console.log(`\nRecent Extractions:`)
      audit.annasArchive.recentExtractions.forEach(item => {
        console.log(`  - ${item.title.substring(0, 50)}... (${item.contentLength.toLocaleString()} chars)`)
        console.log(`    ${item.url.substring(0, 70)}...`)
      })
    }
    
    console.log('\n' + '-'.repeat(80))
    console.log('📰 NEWS SOURCES')
    console.log('-'.repeat(80))
    console.log(`Total Processed: ${audit.news.totalProcessed}`)
    console.log(`Saved: ${audit.news.saved}`)
    console.log(`Success Rate: ${audit.news.successRate.toFixed(1)}%`)
    console.log(`\nTop Sources:`)
    audit.news.sources.forEach(source => {
      console.log(`  - ${source.domain}: ${source.count} items`)
    })
    
    console.log('\n' + '-'.repeat(80))
    console.log('📊 OVERALL DISCOVERY METRICS')
    console.log('-'.repeat(80))
    console.log(`Total Discovered: ${audit.discovery.totalDiscovered.toLocaleString()}`)
    console.log(`Items Saved: ${audit.discovery.itemsSaved.toLocaleString()}`)
    console.log(`Items Processed: ${audit.discovery.itemsProcessed.toLocaleString()}`)
    console.log(`Save Rate: ${audit.discovery.saveRate.toFixed(1)}%`)
    console.log(`Frontier Size: ${audit.discovery.frontierSize}`)
    
    console.log('\n' + '-'.repeat(80))
    console.log('🎯 KEY PERFORMANCE INDICATORS (KPIs)')
    console.log('-'.repeat(80))
    console.log(`Citation Processing Rate: ${audit.kpis.citationProcessingRate} citations/hour`)
    console.log(`Extraction Success Rate: ${audit.kpis.extractionSuccessRate.toFixed(1)}%`)
    console.log(`Duplicate Prevention Rate: ${audit.kpis.duplicatePreventionRate.toFixed(1)}%`)
    console.log(`Source Diversity: ${audit.kpis.sourceDiversity.toFixed(1)}%`)
    console.log(`Time to First Save: ${audit.kpis.timeToFirstSave?.toFixed(1) || 'N/A'} minutes`)
    console.log(`Average Processing Time: ${audit.kpis.averageProcessingTime?.toFixed(2) || 'N/A'} minutes`)
    
    console.log('\n' + '='.repeat(80))
    console.log('✅ AUDIT COMPLETE')
    console.log('='.repeat(80) + '\n')
    
    // Write JSON output
    const fs = await import('fs')
    const path = await import('path')
    const outputPath = path.join(process.cwd(), `audit-${patchHandle}-${Date.now()}.json`)
    fs.writeFileSync(outputPath, JSON.stringify(audit, null, 2))
    console.log(`📄 Full audit data saved to: ${outputPath}\n`)
    
  } catch (error) {
    console.error('❌ Audit failed:', error)
    process.exit(1)
  }
}

if (require.main === module) {
  main().catch(console.error)
}

export { auditDiscoveryRun }

