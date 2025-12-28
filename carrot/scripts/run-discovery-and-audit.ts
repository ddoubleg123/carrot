/**
 * Run Full Discovery Process and Audit
 * 
 * This script:
 * 1. Triggers a discovery run for the Israel patch
 * 2. Monitors the process in real-time
 * 3. Collects comprehensive metrics
 * 4. Provides detailed audit report
 * 
 * DO NOT FIX ANYTHING - Just observe and report
 */

import 'dotenv/config'
import { config } from 'dotenv'
import { resolve } from 'path'
import { prisma } from '../src/lib/prisma'

// Load environment variables from .env file
config({ path: resolve(__dirname, '../.env') })

const PATCH_HANDLE = 'israel'
const MONITORING_INTERVAL = 5000 // Check every 5 seconds
const MAX_MONITORING_TIME = 300000 // Monitor for up to 5 minutes

interface DiscoveryMetrics {
  startTime: Date
  endTime?: Date
  duration?: number
  
  // Discovery Run Status
  runId?: string
  runStatus?: string
  
  // Frontier Stats
  frontierItemsEnqueued?: number
  frontierItemsProcessed?: number
  
  // Content Discovery
  sourcesDiscovered: number
  wikipediaPages: number
  wikipediaCitations: number
  newsArticles: number
  annasArchiveBooks: number
  
  // Processing Stats
  itemsProcessed: number
  itemsSaved: number
  itemsSkipped: number
  itemsFailed: number
  
  // Quality Metrics
  avgRelevanceScore: number
  avgQualityScore: number
  
  // Agent Learning
  feedQueueItems: number
  feedQueueProcessed: number
  agentMemoriesCreated: number
  
  // Errors & Warnings
  errors: string[]
  warnings: string[]
}

async function startDiscovery(patchId: string): Promise<string> {
  console.log(`\n🚀 Starting discovery directly for patch: ${PATCH_HANDLE}`)
  
  try {
    // Import discovery functions
    const { runOpenEvidenceEngine } = await import('../src/lib/discovery/engine')
    const { generateGuideSnapshot, seedFrontierFromPlan } = await import('../src/lib/discovery/planner')
    const { clearFrontier, storeDiscoveryPlan } = await import('../src/lib/redis/discovery')
    
    // Get patch
    const patch = await prisma.patch.findUnique({
      where: { id: patchId },
      select: {
        id: true,
        title: true,
        description: true,
        tags: true,
        entity: true,
        guide: true
      }
    })
    
    if (!patch) {
      throw new Error('Patch not found')
    }
    
    // Create discovery run
    const run = await (prisma as any).discoveryRun.create({
      data: {
        patchId: patch.id,
        status: 'queued'
      }
    })
    
    console.log(`   ✅ Created discovery run: ${run.id}`)
    
    // Generate or get guide
    let guide = patch.guide as any
    if (!guide) {
      console.log(`   📝 Generating discovery guide...`)
      const entity = (patch.entity ?? {}) as { name?: string; aliases?: string[] }
      const topic = entity?.name && entity.name.trim().length ? entity.name.trim() : patch.title
      const aliases = Array.isArray(entity?.aliases) && entity.aliases.length
        ? entity.aliases.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        : (patch.tags as string[]).filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      
      guide = await generateGuideSnapshot(topic, aliases)
      await prisma.patch.update({
        where: { id: patch.id },
        data: { guide: guide as any }
      })
      console.log(`   ✅ Generated guide with ${guide.seedCandidates?.length || 0} seeds`)
    } else {
      console.log(`   ✅ Using existing guide with ${guide.seedCandidates?.length || 0} seeds`)
    }
    
    // Clear frontier and seed
    if (process.env.REDIS_URL) {
      await clearFrontier(patch.id).catch(() => {
        console.warn('   ⚠️  Failed to clear frontier')
      })
      await storeDiscoveryPlan(run.id, guide).catch(() => {
        console.warn('   ⚠️  Failed to store discovery plan')
      })
      console.log(`   ✅ Frontier cleared and plan stored`)
    } else {
      console.warn('   ⚠️  REDIS_URL not set - skipping frontier operations')
    }
    
    // Seed frontier from plan
    console.log(`   🌱 Seeding frontier from plan...`)
    await seedFrontierFromPlan(patch.id, guide)
    console.log(`   ✅ Frontier seeded`)
    
    // Mark run as live
    await (prisma as any).discoveryRun.update({
      where: { id: run.id },
      data: {
        status: 'live',
        startedAt: new Date()
      }
    })
    
    // Start engine (non-blocking)
    console.log(`   🚀 Starting discovery engine...`)
    runOpenEvidenceEngine({
      patchId: patch.id,
      patchHandle: PATCH_HANDLE,
      patchName: patch.title,
      runId: run.id
    }).catch((error) => {
      console.error(`   ❌ Engine failed to start:`, error)
    })
    
    console.log(`   ✅ Discovery engine started (running in background)`)
    
    return run.id
  } catch (error: any) {
    console.error(`❌ Failed to start discovery:`, error.message)
    throw error
  }
}

async function getDiscoveryRunStatus(runId: string) {
  try {
    const run = await (prisma as any).discoveryRun.findUnique({
      where: { id: runId },
      select: {
        id: true,
        status: true,
        startedAt: true,
        completedAt: true,
        metrics: true
      }
    })
    
    return run
  } catch (error) {
    console.warn(`⚠️  Could not fetch run status:`, error)
    return null
  }
}

async function getCurrentMetrics(patchId: string, runStartTime: Date): Promise<DiscoveryMetrics> {
  const now = new Date()
  
  // Get discovery run
  const latestRun = await (prisma as any).discoveryRun.findFirst({
    where: { patchId },
    orderBy: { startedAt: 'desc' },
    select: {
      id: true,
      status: true,
      startedAt: true,
      completedAt: true,
      metrics: true
    }
  })
  
  // Count discovered content (created since run started)
  const recentContent = await prisma.discoveredContent.count({
    where: {
      patchId,
      createdAt: { gte: runStartTime }
    }
  })
  
  // Get source breakdown (since run started)
  const wikipediaContent = await prisma.discoveredContent.count({
    where: {
      patchId,
      sourceDomain: { contains: 'wikipedia.org' },
      createdAt: { gte: runStartTime }
    }
  })
  
  const newsContent = await prisma.discoveredContent.count({
    where: {
      patchId,
      OR: [
        { sourceDomain: { contains: 'news' } },
        { sourceDomain: { contains: 'bbc' } },
        { sourceDomain: { contains: 'reuters' } }
      ],
      createdAt: { gte: runStartTime }
    }
  })
  
  const annasArchiveContent = await prisma.discoveredContent.count({
    where: {
      patchId,
      OR: [
        { sourceDomain: { contains: 'annas-archive.org' } },
        { sourceUrl: { contains: 'annas-archive.org' } },
        { category: { equals: 'book' } }
      ],
      createdAt: { gte: runStartTime }
    }
  })
  
  // Get frontier size from Redis
  let frontierSize = 0
  try {
    const { frontierSize: getFrontierSize } = await import('../src/lib/redis/discovery')
    frontierSize = await getFrontierSize(patchId)
  } catch (error) {
    // Redis may not be available
  }
  
  // Get feed queue stats
  const feedQueueStats = await (prisma as any).agentMemoryFeedQueue.groupBy({
    by: ['status'],
    where: { patchId },
    _count: true
  }).catch(() => [])
  
  const pendingQueue = feedQueueStats.find((s: any) => s.status === 'PENDING')?._count || 0
  const doneQueue = feedQueueStats.find((s: any) => s.status === 'DONE')?._count || 0
  
  // Get agent memories (created since run started)
  const agents = await prisma.agent.findMany({
    where: {
      associatedPatches: { has: PATCH_HANDLE }
    },
    select: { id: true }
  })
  
  let newMemories = 0
  if (agents.length > 0) {
    newMemories = await prisma.agentMemory.count({
      where: {
        agentId: { in: agents.map(a => a.id) },
        sourceType: 'discovery',
        createdAt: { gte: runStartTime }
      }
    })
  }
  
  // Get average scores
  const scoreStats = await prisma.discoveredContent.aggregate({
    where: {
      patchId,
      createdAt: { gte: runStartTime }
    },
    _avg: {
      relevanceScore: true,
      qualityScore: true
    }
  })
  
  return {
    startTime: latestRun?.startedAt || runStartTime,
    endTime: latestRun?.completedAt || undefined,
    duration: latestRun?.startedAt ? (now.getTime() - latestRun.startedAt.getTime()) : (now.getTime() - runStartTime.getTime()),
    runId: latestRun?.id,
    runStatus: latestRun?.status || 'live',
    frontierItemsEnqueued: frontierSize,
    sourcesDiscovered: recentContent,
    wikipediaPages: 0, // Would need to check WikipediaMonitoring
    wikipediaCitations: wikipediaContent,
    newsArticles: newsContent,
    annasArchiveBooks: annasArchiveContent,
    itemsProcessed: recentContent,
    itemsSaved: recentContent,
    avgRelevanceScore: scoreStats._avg.relevanceScore || 0,
    avgQualityScore: scoreStats._avg.qualityScore || 0,
    feedQueueItems: pendingQueue,
    feedQueueProcessed: doneQueue,
    agentMemoriesCreated: newMemories,
    itemsSkipped: 0,
    itemsFailed: 0,
    errors: [],
    warnings: []
  }
}

async function monitorDiscovery(patchId: string, runId: string, runStartTime: Date) {
  console.log(`\n📊 Monitoring discovery run: ${runId}`)
  console.log(`   Patch ID: ${patchId}`)
  console.log(`   Started at: ${runStartTime.toISOString()}`)
  console.log(`   Will monitor for up to ${MAX_MONITORING_TIME / 1000} seconds\n`)
  
  const startTime = Date.now()
  const metrics: DiscoveryMetrics[] = []
  
  while (Date.now() - startTime < MAX_MONITORING_TIME) {
    const currentMetrics = await getCurrentMetrics(patchId, runStartTime)
    metrics.push(currentMetrics)
    
    const elapsed = Math.floor(currentMetrics.duration! / 1000)
    console.log(`[${new Date().toISOString()}] Status: ${currentMetrics.runStatus} (${elapsed}s elapsed)`)
    console.log(`   Items saved: ${currentMetrics.itemsSaved}`)
    console.log(`   Frontier: ${currentMetrics.frontierItemsEnqueued || 0} items`)
    console.log(`   Sources: ${currentMetrics.wikipediaCitations} wiki, ${currentMetrics.newsArticles} news, ${currentMetrics.annasArchiveBooks} books`)
    console.log(`   Feed queue: ${currentMetrics.feedQueueItems} pending, ${currentMetrics.feedQueueProcessed} done`)
    console.log(`   Agent memories: ${currentMetrics.agentMemoriesCreated} created\n`)
    
    // Check if run completed
    const run = await getDiscoveryRunStatus(runId)
    if (run?.status === 'completed' || run?.status === 'error' || run?.status === 'stopped') {
      console.log(`\n✅ Discovery run ${run.status}`)
      break
    }
    
    await new Promise(resolve => setTimeout(resolve, MONITORING_INTERVAL))
  }
  
  return metrics
}

async function generateAuditReport(patchId: string, runId: string, metrics: DiscoveryMetrics[]) {
  console.log('\n' + '='.repeat(80))
  console.log('DISCOVERY PROCESS AUDIT REPORT')
  console.log('='.repeat(80) + '\n')
  
  const finalMetrics = metrics[metrics.length - 1] || metrics[0]
  const initialMetrics = metrics[0]
  
  console.log('📋 RUN INFORMATION')
  console.log(`   Run ID: ${runId}`)
  console.log(`   Patch: ${PATCH_HANDLE}`)
  console.log(`   Status: ${finalMetrics.runStatus || 'unknown'}`)
  console.log(`   Duration: ${finalMetrics.duration ? (finalMetrics.duration / 1000).toFixed(0) : 'N/A'}s`)
  console.log()
  
  console.log('📊 DISCOVERY METRICS')
  console.log(`   Sources Discovered: ${finalMetrics.sourcesDiscovered}`)
  console.log(`     - Wikipedia Citations: ${finalMetrics.wikipediaCitations}`)
  console.log(`     - News Articles: ${finalMetrics.newsArticles}`)
  console.log(`     - Anna's Archive Books: ${finalMetrics.annasArchiveBooks}`)
  console.log()
  
  console.log('💾 PROCESSING STATS')
  console.log(`   Items Processed: ${finalMetrics.itemsProcessed}`)
  console.log(`   Items Saved: ${finalMetrics.itemsSaved}`)
  console.log(`   Average Relevance Score: ${finalMetrics.avgRelevanceScore.toFixed(2)}`)
  console.log(`   Average Quality Score: ${finalMetrics.avgQualityScore.toFixed(2)}`)
  console.log()
  
  console.log('🤖 AGENT LEARNING')
  console.log(`   Feed Queue Items: ${finalMetrics.feedQueueItems} pending`)
  console.log(`   Feed Queue Processed: ${finalMetrics.feedQueueProcessed} done`)
  console.log(`   New Memories Created: ${finalMetrics.agentMemoriesCreated}`)
  console.log()
  
  // Analyze trends
  if (metrics.length > 1) {
    console.log('📈 TRENDS')
    const first = metrics[0]
    const last = metrics[metrics.length - 1]
    const itemsDelta = last.itemsSaved - first.itemsSaved
    const queueDelta = last.feedQueueItems - first.feedQueueItems
    const memoriesDelta = last.agentMemoriesCreated - first.agentMemoriesCreated
    
    console.log(`   Items Saved: ${first.itemsSaved} → ${last.itemsSaved} (${itemsDelta > 0 ? '+' : ''}${itemsDelta})`)
    console.log(`   Feed Queue: ${first.feedQueueItems} → ${last.feedQueueItems} (${queueDelta > 0 ? '+' : ''}${queueDelta})`)
    console.log(`   Memories: ${first.agentMemoriesCreated} → ${last.agentMemoriesCreated} (${memoriesDelta > 0 ? '+' : ''}${memoriesDelta})`)
    console.log()
  }
  
  // Check for issues
  console.log('🔍 PROCESS ANALYSIS')
  
  if (finalMetrics.runStatus === 'error') {
    console.log('   ❌ Discovery run failed')
  } else if (finalMetrics.runStatus === 'completed') {
    console.log('   ✅ Discovery run completed')
  } else if (finalMetrics.runStatus === 'live') {
    console.log('   ⚠️  Discovery run still active')
  }
  
  if (finalMetrics.itemsSaved === 0) {
    console.log('   ⚠️  No items saved - may indicate processing issues')
  }
  
  if (finalMetrics.feedQueueItems > 0 && finalMetrics.agentMemoriesCreated === 0) {
    console.log('   ⚠️  Feed queue has items but no memories created - feed processor may not be running')
  }
  
  if (finalMetrics.annasArchiveBooks === 0 && finalMetrics.sourcesDiscovered > 0) {
    console.log('   ⚠️  Anna\'s Archive sources discovered but none saved')
  }
  
  if (finalMetrics.newsArticles === 0) {
    console.log('   ⚠️  No news articles found - check NEWS_API_KEY configuration')
  }
  
  console.log()
  console.log('='.repeat(80) + '\n')
}

async function main() {
  try {
    // Get patch
    const patch = await prisma.patch.findUnique({
      where: { handle: PATCH_HANDLE },
      select: { id: true, title: true }
    })
    
    if (!patch) {
      console.error(`❌ Patch "${PATCH_HANDLE}" not found`)
      process.exit(1)
    }
    
    console.log(`\n🎯 Running Discovery Audit for: ${patch.title}`)
    console.log(`   Patch ID: ${patch.id}\n`)
    
    // Start discovery directly
    const runId = await startDiscovery(patch.id)
    
    if (!runId) {
      console.error('❌ Could not get run ID from discovery start')
      process.exit(1)
    }
    
    // Monitor the process
    const metrics = await monitorDiscovery(patch.id, runId)
    
    // Generate audit report
    await generateAuditReport(patch.id, runId, metrics)
    
    // Wait a bit more to capture final state
    console.log('⏳ Waiting 30 seconds for final metrics...')
    await new Promise(resolve => setTimeout(resolve, 30000))
    
    const finalMetrics = await getCurrentMetrics(patch.id, runStartTime)
    console.log('\n📊 FINAL METRICS')
    console.log(JSON.stringify(finalMetrics, null, 2))
    
  } catch (error) {
    console.error('\n❌ Audit failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()

