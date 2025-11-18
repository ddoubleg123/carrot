/**
 * CLI script: yarn report:zero --since 15m
 * Reports on zero results and crawl diagnostics
 */

import { prisma } from '../src/lib/prisma'
import { getDiscoveryQueueDepth, getExtractionQueueDepth } from '../src/lib/crawler/queues'

interface ReportOptions {
  since: string // e.g., "15m", "1h", "30m"
}

function parseSince(since: string): number {
  const match = since.match(/^(\d+)([mh])$/)
  if (!match) {
    throw new Error(`Invalid --since format: ${since}. Use format like "15m" or "1h"`)
  }
  
  const value = Number(match[1])
  const unit = match[2]
  
  if (unit === 'm') {
    return value * 60 * 1000
  } else if (unit === 'h') {
    return value * 60 * 60 * 1000
  }
  
  throw new Error(`Unknown unit: ${unit}`)
}

async function generateReport(options: ReportOptions) {
  const sinceMs = parseSince(options.since)
  const sinceDate = new Date(Date.now() - sinceMs)
  
  console.log(`\n=== Zero Results Report (since ${options.since}) ===\n`)
  
  // Get pages from last period
  const pages = await prisma.crawlerPage.findMany({
    where: {
      firstSeenAt: {
        gte: sinceDate,
      },
    },
    select: {
      id: true,
      url: true,
      domain: true,
      status: true,
      httpStatus: true,
      reasonCode: true,
      extractedText: true,
      firstSeenAt: true,
    },
    orderBy: {
      firstSeenAt: 'desc',
    },
    take: 50,
  })
  
  // Get extractions from last period
  const extractions = await prisma.crawlerExtraction.findMany({
    where: {
      createdAt: {
        gte: sinceDate,
      },
    },
    select: {
      id: true,
      sourceUrl: true,
      topic: true,
      createdAt: true,
    },
  })
  
  // Calculate statistics
  const totalPages = pages.length
  const fetched = pages.filter(p => p.status === 'fetched').length
  const failed = pages.filter(p => p.status === 'failed').length
  const extracted = extractions.length
  
  const wikiPages = pages.filter(p => p.domain?.includes('wikipedia.org')).length
  const nonWikiPages = totalPages - wikiPages
  
  const shortText = pages.filter(p => (p.extractedText?.length || 0) < 500).length
  
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
  
  // Queue depths
  const discoveryDepth = await getDiscoveryQueueDepth().catch(() => -1)
  const extractionDepth = await getExtractionQueueDepth().catch(() => -1)
  
  // Print report
  console.log('📊 Summary:')
  console.log(`  Total pages processed: ${totalPages}`)
  console.log(`  Successfully fetched: ${fetched}`)
  console.log(`  Failed: ${failed}`)
  console.log(`  Extracted: ${extracted}`)
  console.log(`  Extraction rate: ${totalPages > 0 ? ((extracted / totalPages) * 100).toFixed(1) : 0}%`)
  console.log('')
  
  console.log('🌐 Domain Distribution:')
  console.log(`  Wikipedia: ${wikiPages} (${totalPages > 0 ? ((wikiPages / totalPages) * 100).toFixed(1) : 0}%)`)
  console.log(`  Non-Wikipedia: ${nonWikiPages} (${totalPages > 0 ? ((nonWikiPages / totalPages) * 100).toFixed(1) : 0}%)`)
  console.log('')
  
  console.log('📝 Content Quality:')
  console.log(`  Short text (<500 chars): ${shortText} (${totalPages > 0 ? ((shortText / totalPages) * 100).toFixed(1) : 0}%)`)
  console.log('')
  
  console.log('❌ Failure Reasons (top 5):')
  const sortedReasons = Object.entries(reasonCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
  sortedReasons.forEach(([reason, count]) => {
    console.log(`  ${reason}: ${count}`)
  })
  if (sortedReasons.length === 0) {
    console.log('  (no failures recorded)')
  }
  console.log('')
  
  console.log('🌍 Top Domains (top 10):')
  const sortedDomains = Object.entries(domainCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
  sortedDomains.forEach(([domain, count]) => {
    console.log(`  ${domain}: ${count}`)
  })
  console.log('')
  
  console.log('📋 Queue Depths:')
  console.log(`  Discovery queue: ${discoveryDepth}`)
  console.log(`  Extraction queue: ${extractionDepth}`)
  console.log('')
  
  if (extracted === 0 && fetched > 0) {
    console.log('⚠️  ZERO EXTRACTIONS ALERT:')
    console.log('  Extractions = 0 but pages were fetched')
    console.log('  Last 10 URLs attempted:')
    pages.slice(0, 10).forEach((p, i) => {
      console.log(`    ${i + 1}. ${p.url?.slice(0, 80)}... [${p.status}] ${p.reasonCode || ''}`)
    })
    console.log('')
  }
  
  console.log('=== End Report ===\n')
}

// Parse command line arguments
const args = process.argv.slice(2)
const sinceIndex = args.indexOf('--since')
const since = sinceIndex >= 0 && args[sinceIndex + 1] 
  ? args[sinceIndex + 1] 
  : '15m'

generateReport({ since })
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error generating report:', error)
    process.exit(1)
  })

