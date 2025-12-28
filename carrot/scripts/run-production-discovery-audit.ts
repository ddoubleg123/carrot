/**
 * Production Discovery Audit Script
 * 
 * This script audits discovery on PRODUCTION by:
 * 1. Triggering discovery via API (if authenticated) OR using direct DB functions
 * 2. Monitoring via API endpoints and/or direct database queries
 * 3. Collecting comprehensive metrics
 * 
 * Usage:
 *   # With production database connection
 *   DATABASE_URL="postgresql://..." REDIS_URL="rediss://..." npx tsx scripts/run-production-discovery-audit.ts
 * 
 *   # Or trigger via API and monitor (requires auth token)
 *   API_TOKEN="..." npx tsx scripts/run-production-discovery-audit.ts --api
 */

import 'dotenv/config'
import { prisma } from '../src/lib/prisma'

const PATCH_HANDLE = 'israel'
const PRODUCTION_URL = 'https://carrot-app.onrender.com'
const MONITORING_INTERVAL = 10000 // Check every 10 seconds
const MAX_MONITORING_TIME = 600000 // Monitor for up to 10 minutes

interface DiscoveryMetrics {
  timestamp: Date
  runId?: string
  runStatus?: string
  
  // Frontier Stats
  frontierItemsEnqueued?: number
  
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

async function triggerDiscoveryViaAPI(): Promise<string | null> {
  const apiToken = process.env.API_TOKEN
  if (!apiToken) {
    console.log('⚠️  API_TOKEN not set - cannot trigger via API')
    return null
  }
  
  console.log(`\n🚀 Triggering discovery via API: ${PRODUCTION_URL}`)
  
  try {
    const response = await fetch(`${PRODUCTION_URL}/api/patches/${PATCH_HANDLE}/start-discovery`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiToken}`
      },
      body: JSON.stringify({ action: 'start_deepseek_search' })
    })
    
    if (!response.ok) {
      const error = await response.text()
      console.error(`❌ API request failed: HTTP ${response.status}: ${error}`)
      return null
    }
    
    const data = await response.json()
    console.log(`✅ Discovery triggered via API:`, data)
    
    return data.runId || data.id || null
  } catch (error: any) {
    console.error(`❌ Failed to trigger via API:`, error.message)
    return null
  }
}

async function getMetricsViaAPI(patchHandle: string): Promise<any> {
  try {
    const response = await fetch(`${PRODUCTION_URL}/api/patches/${patchHandle}/discover-metrics`)
    
    if (!response.ok) {
      return null
    }
    
    return await response.json()
  } catch (error) {
    return null
  }
}

async function triggerDiscoveryDirectly(patchId: string): Promise<string> {
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

async function getCurrentMetrics(patchId: string, runStartTime: Date, useAPI: boolean = false): Promise<DiscoveryMetrics> {
  const now = new Date()
  
  // Try API first if enabled
  if (useAPI) {
    const apiMetrics = await getMetricsViaAPI(PATCH_HANDLE)
    if (apiMetrics) {
      // Map API response to our metrics format
      return {
        timestamp: now,
        runStatus: 'live', // API doesn't provide run status
        sourcesDiscovered: apiMetrics.metrics?.saved || 0,
        itemsSaved: apiMetrics.metrics?.saved || 0,
        itemsProcessed: apiMetrics.metrics?.processed || 0,
        wikipediaCitations: 0, // Would need to query separately
        newsArticles: 0,
        annasArchiveBooks: 0,
        wikipediaPages: 0,
        itemsSkipped: apiMetrics.metrics?.skipped || 0,
        itemsFailed: 0,
        avgRelevanceScore: 0,
        avgQualityScore: 0,
        feedQueueItems: 0,
        feedQueueProcessed: 0,
        agentMemoriesCreated: 0,
        errors: [],
        warnings: []
      }
    }
  }
  
  // Fallback to direct database queries
  const allRuns = await (prisma as any).discoveryRun.findMany({
    where: { patchId },
    orderBy: { id: 'desc' }, // Use id for ordering (newer IDs are later)
    take: 1,
    select: {
      id: true,
      status: true,
      startedAt: true,
      completedAt: true,
      metrics: true
    }
  })
  const latestRun = allRuns[0] || null
  
  // Count discovered content (created since run started)
  const recentContent = await prisma.discoveredContent.count({
    where: {
      patchId,
      createdAt: { gte: runStartTime }
    }
  })
  
  // Get source breakdown
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
  
  // Get agent memories
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
    timestamp: now,
    startTime: latestRun?.startedAt || runStartTime,
    endTime: latestRun?.completedAt || undefined,
    duration: latestRun?.startedAt ? (now.getTime() - latestRun.startedAt.getTime()) : (now.getTime() - runStartTime.getTime()),
    runId: latestRun?.id,
    runStatus: latestRun?.status || 'live',
    frontierItemsEnqueued: frontierSize,
    sourcesDiscovered: recentContent,
    wikipediaPages: 0,
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

async function monitorDiscovery(patchId: string, runId: string, runStartTime: Date, useAPI: boolean = false) {
  console.log(`\n📊 Monitoring discovery run: ${runId}`)
  console.log(`   Patch ID: ${patchId}`)
  console.log(`   Started at: ${runStartTime.toISOString()}`)
  console.log(`   Monitoring mode: ${useAPI ? 'API' : 'Direct Database'}`)
  console.log(`   Will monitor for up to ${MAX_MONITORING_TIME / 1000} seconds\n`)
  
  const startTime = Date.now()
  const metrics: DiscoveryMetrics[] = []
  
  while (Date.now() - startTime < MAX_MONITORING_TIME) {
    const currentMetrics = await getCurrentMetrics(patchId, runStartTime, useAPI)
    metrics.push(currentMetrics)
    
    const elapsed = Math.floor(currentMetrics.duration! / 1000)
    console.log(`[${new Date().toISOString()}] Status: ${currentMetrics.runStatus} (${elapsed}s elapsed)`)
    console.log(`   Items saved: ${currentMetrics.itemsSaved}`)
    console.log(`   Frontier: ${currentMetrics.frontierItemsEnqueued || 0} items`)
    console.log(`   Sources: ${currentMetrics.wikipediaCitations} wiki, ${currentMetrics.newsArticles} news, ${currentMetrics.annasArchiveBooks} books`)
    console.log(`   Feed queue: ${currentMetrics.feedQueueItems} pending, ${currentMetrics.feedQueueProcessed} done`)
    console.log(`   Agent memories: ${currentMetrics.agentMemoriesCreated} created\n`)
    
    // Check if run completed
    if (!useAPI) {
      const run = await (prisma as any).discoveryRun.findUnique({
        where: { id: runId },
        select: { status: true }
      })
      
      if (run?.status === 'completed' || run?.status === 'error' || run?.status === 'stopped') {
        console.log(`\n✅ Discovery run ${run.status}`)
        break
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, MONITORING_INTERVAL))
  }
  
  return metrics
}

async function generateAuditReport(patchId: string, runId: string, metrics: DiscoveryMetrics[]) {
  console.log('\n' + '='.repeat(80))
  console.log('PRODUCTION DISCOVERY PROCESS AUDIT REPORT')
  console.log('='.repeat(80) + '\n')
  
  const finalMetrics = metrics[metrics.length - 1] || metrics[0]
  const initialMetrics = metrics[0]
  
  console.log('📋 RUN INFORMATION')
  console.log(`   Run ID: ${runId}`)
  console.log(`   Patch: ${PATCH_HANDLE}`)
  console.log(`   Environment: PRODUCTION`)
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
  
  console.log('='.repeat(80) + '\n')
}

async function main() {
  const useAPI = process.argv.includes('--api')
  const useProductionDB = !!process.env.DATABASE_URL
  
  if (!useProductionDB && !useAPI) {
    console.error('\n❌ ERROR: Must specify either:')
    console.error('   1. DATABASE_URL environment variable (for direct database access)')
    console.error('   2. --api flag with API_TOKEN (for API-based monitoring)')
    console.error('\nExample:')
    console.error('   DATABASE_URL="postgresql://..." REDIS_URL="rediss://..." npx tsx scripts/run-production-discovery-audit.ts')
    console.error('   OR')
    console.error('   API_TOKEN="..." npx tsx scripts/run-production-discovery-audit.ts --api')
    process.exit(1)
  }
  
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
    
    console.log(`\n🎯 Running PRODUCTION Discovery Audit for: ${patch.title}`)
    console.log(`   Patch ID: ${patch.id}`)
    console.log(`   Environment: ${useProductionDB ? 'Direct Database' : 'API-Based'}\n`)
    
    // Trigger discovery
    const runStartTime = new Date()
    let runId: string | null = null
    
    if (useAPI) {
      runId = await triggerDiscoveryViaAPI()
      if (!runId) {
        console.error('❌ Could not trigger discovery via API')
        process.exit(1)
      }
    } else {
      runId = await triggerDiscoveryDirectly(patch.id)
    }
    
    // Wait a moment for engine to start
    console.log('   ⏳ Waiting 10 seconds for engine to initialize...')
    await new Promise(resolve => setTimeout(resolve, 10000))
    
    // Monitor the process
    const metrics = await monitorDiscovery(patch.id, runId, runStartTime, useAPI)
    
    // Generate audit report
    await generateAuditReport(patch.id, runId, metrics)
    
    // Wait a bit more to capture final state
    console.log('⏳ Waiting 30 seconds for final metrics...')
    await new Promise(resolve => setTimeout(resolve, 30000))
    
    const finalMetrics = await getCurrentMetrics(patch.id, runStartTime, useAPI)
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

