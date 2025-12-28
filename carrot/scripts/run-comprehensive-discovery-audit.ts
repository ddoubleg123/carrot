/**
 * Comprehensive Discovery Audit Script
 * 
 * Tracks:
 * 1. Citations found (Wikipedia citations)
 * 2. Content saved (DiscoveredContent by source type)
 * 3. Data extraction (Anna's Archive, NewsAPI, Wikipedia)
 * 4. Agent learning (AgentMemoryFeedQueue, AgentMemory)
 * 
 * Usage:
 *   DATABASE_URL="postgresql://..." REDIS_URL="rediss://..." npx tsx scripts/run-comprehensive-discovery-audit.ts
 */

import 'dotenv/config'
import { prisma } from '../src/lib/prisma'
import { seedFrontierFromPlan, generateGuideSnapshot } from '../src/lib/discovery/planner'
import { runOpenEvidenceEngine } from '../src/lib/discovery/engine'
import { clearFrontier, storeDiscoveryPlan } from '../src/lib/redis/discovery'

const PATCH_HANDLE = 'israel'
const MONITORING_INTERVAL = 15000 // Check every 15 seconds
const MAX_MONITORING_TIME = 900000 // Monitor for up to 15 minutes

interface ComprehensiveMetrics {
  timestamp: Date
  runId: string
  runStatus: string
  
  // Discovery Run Stats
  runStartedAt?: Date
  runDuration?: number // seconds
  
  // Frontier Stats
  frontierSize?: number
  
  // Citations
  wikipediaCitationsFound: number
  wikipediaCitationsProcessed: number
  wikipediaCitationsSaved: number
  
  // Content Discovery & Saving (by source type)
  discoveredContent: {
    total: number
    annasArchive: number
    newsAPI: number
    wikipedia: number
    wikipediaCitations: number
    other: number
  }
  
  // Content Saved (DiscoveredContent table)
  savedContent: {
    total: number
    annasArchive: number // sourceDomain contains 'annas-archive.org'
    newsAPI: number // provider or metadata indicates NewsAPI
    wikipedia: number // sourceDomain contains 'wikipedia.org' or category is 'wikipedia'
    wikipediaCitations: number // category is 'wikipedia_citation'
    other: number
  }
  
  // Content Quality Metrics
  contentWithText: number // Has textContent
  avgTextLength: number
  avgRelevanceScore: number
  avgQualityScore: number
  
  // Agent Learning
  feedQueueItems: number
  feedQueueProcessed: number
  agentMemoriesCreated: number
  
  // Processing Stats
  itemsProcessed: number
  itemsSkipped: number
  itemsFailed: number
  
  // Errors
  errors: string[]
  warnings: string[]
}

async function triggerDiscoveryDirectly(patchId: string): Promise<string> {
  const patch = await prisma.patch.findUnique({
    where: { id: patchId },
    select: { id: true, title: true, description: true, tags: true, guide: true }
  })

  if (!patch) {
    throw new Error(`Patch with ID "${patchId}" not found`)
  }

  console.log(`\n🚀 Starting discovery for patch: ${PATCH_HANDLE}`)

  // Create a new discovery run record
  const run = await prisma.discoveryRun.create({
    data: {
      patchId: patch.id,
      status: 'queued',
      metrics: {}
    }
  })

  console.log(`   ✅ Discovery run created: ${run.id}`)

  // Generate or get discovery plan
  let guide = patch.guide as any
  if (!guide || !guide.seedCandidates) {
    console.log('   ⏳ Generating discovery plan...')
    const topic = patch.title
    const aliases = patch.tags.filter((t): t is string => typeof t === 'string')
    guide = await generateGuideSnapshot(topic, aliases)
    await prisma.patch.update({
      where: { id: patch.id },
      data: { guide: guide as any }
    })
    console.log(`   ✅ Generated plan with ${guide.seedCandidates?.length || 0} seed candidates`)
  } else {
    console.log(`   ✅ Using existing plan with ${guide.seedCandidates?.length || 0} seed candidates`)
  }

  // Clear frontier and seed
  if (process.env.REDIS_URL) {
    await clearFrontier(patch.id).catch((error) => {
      console.warn(`   ⚠️  Failed to clear frontier: ${error.message}`)
    })
    await storeDiscoveryPlan(run.id, guide).catch((error) => {
      console.warn(`   ⚠️  Failed to store discovery plan: ${error.message}`)
    })
    console.log(`   ✅ Frontier cleared and plan stored`)
  } else {
    console.warn(`   ⚠️  REDIS_URL not set - skipping frontier operations`)
  }
  
  console.log(`   🌱 Seeding frontier from plan...`)
  await seedFrontierFromPlan(patch.id, guide)
  console.log(`   ✅ Frontier seeded`)

  // Mark run as live
  await prisma.discoveryRun.update({
    where: { id: run.id },
    data: { status: 'live', startedAt: new Date() }
  })

  console.log(`   🚀 Starting discovery engine...`)
  // Start engine (non-blocking)
  runOpenEvidenceEngine({
    patchId: patch.id,
    patchHandle: PATCH_HANDLE,
    patchName: patch.title,
    runId: run.id
  }).catch((error) => {
    console.error(`   ❌ Engine failed: ${error.message}`)
    // Update run status to error
    prisma.discoveryRun.update({
      where: { id: run.id },
      data: { status: 'error', endedAt: new Date(), metrics: { error: error.message } }
    }).catch(console.error)
  })
  console.log(`   ✅ Discovery engine started (running in background)`)

  return run.id
}

async function getComprehensiveMetrics(patchId: string, runId: string, runStartTime: Date): Promise<ComprehensiveMetrics> {
  const now = new Date()
  
  // Get discovery run status
  const run = await prisma.discoveryRun.findUnique({
    where: { id: runId },
    select: {
      id: true,
      status: true,
      startedAt: true,
      endedAt: true,
      metrics: true
    }
  })
  
  const runStatus = run?.status || 'unknown'
  const runStartedAt = run?.startedAt || runStartTime
  const runDuration = run?.endedAt 
    ? Math.floor((run.endedAt.getTime() - runStartedAt.getTime()) / 1000)
    : Math.floor((now.getTime() - runStartedAt.getTime()) / 1000)
  
  // Get frontier size (if Redis is available)
  let frontierSize: number | undefined
  if (process.env.REDIS_URL) {
    try {
      const { frontierSize: size } = await import('../src/lib/redis/discovery')
      frontierSize = await size(patchId).catch(() => undefined)
    } catch {
      // Redis not available
    }
  }
  
  // Get Wikipedia citations
  const wikipediaCitations = await prisma.wikipediaCitation.findMany({
    where: {
      monitoring: {
        patchId: patchId
      },
      createdAt: {
        gte: runStartTime
      }
    },
    select: {
      id: true,
      citationUrl: true,
      citationTitle: true,
      relevanceDecision: true,
      scanStatus: true,
      savedContentId: true,
      savedMemoryId: true,
      createdAt: true
    }
  })
  
  const wikipediaCitationsFound = wikipediaCitations.length
  const wikipediaCitationsProcessed = wikipediaCitations.filter(c => c.scanStatus === 'processed' || c.scanStatus === 'saved').length
  const wikipediaCitationsSaved = wikipediaCitations.filter(c => c.savedContentId !== null).length
  
  // Get all discovered content saved in this run (by created time after run start)
  const allSavedContent = await prisma.discoveredContent.findMany({
    where: {
      patchId: patchId,
      createdAt: {
        gte: runStartTime
      }
    },
    select: {
      id: true,
      title: true,
      canonicalUrl: true,
      sourceDomain: true,
      category: true,
      type: true,
      textContent: true,
      relevanceScore: true,
      qualityScore: true,
      createdAt: true,
      metadata: true
    }
  })
  
  // Categorize saved content
  const annasArchiveContent = allSavedContent.filter(c => 
    c.sourceDomain?.includes('annas-archive.org') || 
    c.type === 'book' ||
    (c.metadata as any)?.source === "Anna's Archive"
  )
  
  const newsAPIContent = allSavedContent.filter(c =>
    (c.metadata as any)?.source === 'NewsAPI' ||
    (c.metadata as any)?.provider === 'newsapi' ||
    c.sourceDomain?.includes('newsapi.org')
  )
  
  const wikipediaPages = allSavedContent.filter(c =>
    (c.sourceDomain?.includes('wikipedia.org') || c.category === 'wikipedia') &&
    c.category !== 'wikipedia_citation'
  )
  
  const wikipediaCitationsSavedContent = allSavedContent.filter(c =>
    c.category === 'wikipedia_citation'
  )
  
  const otherContent = allSavedContent.filter(c =>
    !annasArchiveContent.includes(c) &&
    !newsAPIContent.includes(c) &&
    !wikipediaPages.includes(c) &&
    !wikipediaCitationsSavedContent.includes(c)
  )
  
  // Content quality metrics
  const contentWithText = allSavedContent.filter(c => c.textContent && c.textContent.length > 0).length
  const totalTextLength = allSavedContent.reduce((sum, c) => sum + (c.textContent?.length || 0), 0)
  const avgTextLength = allSavedContent.length > 0 ? totalTextLength / allSavedContent.length : 0
  const avgRelevanceScore = allSavedContent.length > 0
    ? allSavedContent.reduce((sum, c) => sum + (c.relevanceScore || 0), 0) / allSavedContent.length
    : 0
  const avgQualityScore = allSavedContent.length > 0
    ? allSavedContent.reduce((sum, c) => sum + (c.qualityScore || 0), 0) / allSavedContent.length
    : 0
  
  // Agent learning metrics
  const feedQueueItems = await prisma.agentMemoryFeedQueue.count({
    where: {
      patchId: patchId,
      enqueuedAt: {
        gte: runStartTime
      }
    }
  })
  
  // Check for processed items (items with status 'DONE' or pickedAt not null)
  const feedQueueProcessed = await prisma.agentMemoryFeedQueue.count({
    where: {
      patchId: patchId,
      enqueuedAt: {
        gte: runStartTime
      },
      OR: [
        { status: 'DONE' },
        { pickedAt: { not: null } }
      ]
    }
  })
  
  const agentMemoriesCreated = await prisma.agentMemory.count({
    where: {
      patchId: patchId,
      createdAt: {
        gte: runStartTime
      }
    }
  })
  
  // Get processing stats from run metrics or audit logs
  const runMetrics = (run?.metrics as any) || {}
  const itemsProcessed = runMetrics.candidatesProcessed || runMetrics.processed || 0
  const itemsSkipped = runMetrics.duplicates || runMetrics.skipped || 0
  const itemsFailed = runMetrics.failures || runMetrics.errors || 0
  
  // Get errors from audit logs
  const auditLogs = await prisma.discoveryAudit.findMany({
    where: {
      runId: runId,
      status: 'fail'
    },
    select: {
      step: true,
      meta: true,
      ts: true
    },
    orderBy: {
      ts: 'desc'
    },
    take: 10
  })
  
  const errors = auditLogs.map(log => 
    `${log.step}: ${JSON.stringify(log.meta)}`
  )
  
  // Warnings
  const warnings: string[] = []
  if (contentWithText < allSavedContent.length * 0.9) {
    warnings.push(`Only ${contentWithText}/${allSavedContent.length} saved content items have text content`)
  }
  if (wikipediaCitationsFound > 0 && wikipediaCitationsSaved / wikipediaCitationsFound < 0.5) {
    warnings.push(`Low citation save rate: ${wikipediaCitationsSaved}/${wikipediaCitationsFound} saved`)
  }
  if (feedQueueItems > 0 && feedQueueProcessed / feedQueueItems < 0.5) {
    warnings.push(`Low feed queue processing rate: ${feedQueueProcessed}/${feedQueueItems} processed`)
  }
  
  return {
    timestamp: now,
    runId,
    runStatus,
    runStartedAt,
    runDuration,
    frontierSize,
    wikipediaCitationsFound,
    wikipediaCitationsProcessed,
    wikipediaCitationsSaved,
    discoveredContent: {
      total: allSavedContent.length, // Using saved content as proxy for discovered
      annasArchive: annasArchiveContent.length,
      newsAPI: newsAPIContent.length,
      wikipedia: wikipediaPages.length,
      wikipediaCitations: wikipediaCitationsSavedContent.length,
      other: otherContent.length
    },
    savedContent: {
      total: allSavedContent.length,
      annasArchive: annasArchiveContent.length,
      newsAPI: newsAPIContent.length,
      wikipedia: wikipediaPages.length,
      wikipediaCitations: wikipediaCitationsSavedContent.length,
      other: otherContent.length
    },
    contentWithText,
    avgTextLength: Math.round(avgTextLength),
    avgRelevanceScore: Math.round(avgRelevanceScore * 100) / 100,
    avgQualityScore: Math.round(avgQualityScore * 100) / 100,
    feedQueueItems,
    feedQueueProcessed,
    agentMemoriesCreated,
    itemsProcessed,
    itemsSkipped,
    itemsFailed,
    errors,
    warnings
  }
}

function printMetrics(metrics: ComprehensiveMetrics) {
  console.log(`\n${'='.repeat(80)}`)
  console.log(`📊 COMPREHENSIVE DISCOVERY METRICS - ${metrics.timestamp.toISOString()}`)
  console.log(`${'='.repeat(80)}\n`)
  
  console.log(`🔍 DISCOVERY RUN:`)
  console.log(`   Run ID: ${metrics.runId}`)
  console.log(`   Status: ${metrics.runStatus}`)
  console.log(`   Duration: ${metrics.runDuration}s`)
  if (metrics.frontierSize !== undefined) {
    console.log(`   Frontier Size: ${metrics.frontierSize}`)
  }
  console.log()
  
  console.log(`📚 CITATIONS:`)
  console.log(`   Wikipedia Citations Found: ${metrics.wikipediaCitationsFound}`)
  console.log(`   Wikipedia Citations Processed: ${metrics.wikipediaCitationsProcessed}`)
  console.log(`   Wikipedia Citations Saved: ${metrics.wikipediaCitationsSaved}`)
  if (metrics.wikipediaCitationsFound > 0) {
    const saveRate = (metrics.wikipediaCitationsSaved / metrics.wikipediaCitationsFound * 100).toFixed(1)
    console.log(`   Citation Save Rate: ${saveRate}%`)
  }
  console.log()
  
  console.log(`💾 CONTENT SAVED (DiscoveredContent):`)
  console.log(`   Total Saved: ${metrics.savedContent.total}`)
  console.log(`   ├─ Anna's Archive Books: ${metrics.savedContent.annasArchive}`)
  console.log(`   ├─ NewsAPI Articles: ${metrics.savedContent.newsAPI}`)
  console.log(`   ├─ Wikipedia Pages: ${metrics.savedContent.wikipedia}`)
  console.log(`   ├─ Wikipedia Citations: ${metrics.savedContent.wikipediaCitations}`)
  console.log(`   └─ Other: ${metrics.savedContent.other}`)
  console.log()
  
  console.log(`📝 CONTENT QUALITY:`)
  console.log(`   Items with Text Content: ${metrics.contentWithText}/${metrics.savedContent.total}`)
  console.log(`   Avg Text Length: ${metrics.avgTextLength.toLocaleString()} chars`)
  console.log(`   Avg Relevance Score: ${metrics.avgRelevanceScore}`)
  console.log(`   Avg Quality Score: ${metrics.avgQualityScore}`)
  console.log()
  
  console.log(`🤖 AGENT LEARNING:`)
  console.log(`   Feed Queue Items: ${metrics.feedQueueItems}`)
  console.log(`   Feed Queue Processed: ${metrics.feedQueueProcessed}`)
  console.log(`   Agent Memories Created: ${metrics.agentMemoriesCreated}`)
  if (metrics.feedQueueItems > 0) {
    const processingRate = (metrics.feedQueueProcessed / metrics.feedQueueItems * 100).toFixed(1)
    console.log(`   Feed Processing Rate: ${processingRate}%`)
  }
  console.log()
  
  console.log(`⚙️  PROCESSING:`)
  console.log(`   Items Processed: ${metrics.itemsProcessed}`)
  console.log(`   Items Skipped: ${metrics.itemsSkipped}`)
  console.log(`   Items Failed: ${metrics.itemsFailed}`)
  console.log()
  
  if (metrics.errors.length > 0) {
    console.log(`❌ ERRORS (${metrics.errors.length}):`)
    metrics.errors.forEach((error, idx) => {
      console.log(`   ${idx + 1}. ${error}`)
    })
    console.log()
  }
  
  if (metrics.warnings.length > 0) {
    console.log(`⚠️  WARNINGS (${metrics.warnings.length}):`)
    metrics.warnings.forEach((warning, idx) => {
      console.log(`   ${idx + 1}. ${warning}`)
    })
    console.log()
  }
  
  console.log(`${'='.repeat(80)}\n`)
}

async function main() {
  console.log(`\n🔍 COMPREHENSIVE DISCOVERY AUDIT`)
  console.log(`Patch: ${PATCH_HANDLE}`)
  console.log(`Timestamp: ${new Date().toISOString()}\n`)
  
  // Get patch
  const patch = await prisma.patch.findUnique({
    where: { handle: PATCH_HANDLE },
    select: { id: true, title: true }
  })
  
  if (!patch) {
    console.error(`❌ Patch "${PATCH_HANDLE}" not found`)
    process.exit(1)
  }
  
  console.log(`✅ Found patch: ${patch.title} (${patch.id})\n`)
  
  // Trigger discovery
  const runStartTime = new Date()
  const runId = await triggerDiscoveryDirectly(patch.id)
  
  console.log(`\n⏳ Monitoring discovery run ${runId}...`)
  console.log(`   Checking every ${MONITORING_INTERVAL / 1000}s for up to ${MAX_MONITORING_TIME / 1000}s\n`)
  
  const startTime = Date.now()
  let lastMetrics: ComprehensiveMetrics | null = null
  let consecutiveUnchanged = 0
  
  while (Date.now() - startTime < MAX_MONITORING_TIME) {
    const metrics = await getComprehensiveMetrics(patch.id, runId, runStartTime)
    
    printMetrics(metrics)
    
    // Check if run is complete
    if (metrics.runStatus === 'completed' || metrics.runStatus === 'error' || metrics.runStatus === 'suspended') {
      console.log(`\n✅ Discovery run ${metrics.runStatus}. Final metrics above.`)
      break
    }
    
    // Check if metrics are unchanged (run might be stuck)
    if (lastMetrics) {
      if (
        metrics.savedContent.total === lastMetrics.savedContent.total &&
        metrics.itemsProcessed === lastMetrics.itemsProcessed &&
        metrics.wikipediaCitationsFound === lastMetrics.wikipediaCitationsFound
      ) {
        consecutiveUnchanged++
        if (consecutiveUnchanged >= 4) {
          console.log(`\n⚠️  Metrics unchanged for ${consecutiveUnchanged * (MONITORING_INTERVAL / 1000)}s - run may be stuck or complete`)
          console.log(`   Final metrics above.`)
          break
        }
      } else {
        consecutiveUnchanged = 0
      }
    }
    
    lastMetrics = metrics
    
    // Wait before next check
    await new Promise(resolve => setTimeout(resolve, MONITORING_INTERVAL))
  }
  
  // Final metrics
  console.log(`\n📊 FINAL AUDIT REPORT:`)
  if (lastMetrics) {
    printMetrics(lastMetrics)
  }
  
  // Generate summary report file
  const reportPath = `carrot/DISCOVERY_AUDIT_${runId}_${new Date().toISOString().split('T')[0]}.json`
  const fs = await import('fs/promises')
  await fs.writeFile(
    reportPath,
    JSON.stringify({
      runId,
      patchId: patch.id,
      patchHandle: PATCH_HANDLE,
      runStartTime: runStartTime.toISOString(),
      auditCompletedAt: new Date().toISOString(),
      finalMetrics: lastMetrics
    }, null, 2)
  )
  console.log(`\n💾 Full report saved to: ${reportPath}\n`)
  
  await prisma.$disconnect()
}

main().catch((error) => {
  console.error('❌ Audit failed:', error)
  process.exit(1)
})

