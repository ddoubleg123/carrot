/**
 * Full Citations Audit - Investigate discovery completion and issues
 * 
 * Questions:
 * 1. Are we done finding all citations? If not, why?
 * 2. Why have we only saved 171? What's wrong?
 * 3. Why are agent memories not the same as saved items?
 */

import 'dotenv/config'
import { prisma } from '../src/lib/prisma'

const PATCH_HANDLE = 'israel'

interface CitationStats {
  total: number
  scanned: number
  notScanned: number
  scanning: number
  scannedPercentage: number
  
  // Relevance scoring
  withRelevanceScore: number
  withoutRelevanceScore: number
  avgRelevanceScore: number | null
  savedCount: number
  deniedCount: number
  noDecisionCount: number
  
  // Save rate analysis
  savedFromScanned: number
  savedFromRelevant: number
  saveRateFromScanned: number
  saveRateFromRelevant: number
  
  // Saved content analysis
  savedContentTotal: number
  savedFromCitations: number
  
  // Extraction analysis
  extractedCount: number
  extractedPercentage: number
  
  // Agent memory analysis
  agentMemoriesCount: number
  agentMemoriesFromSaved: number
  agentMemoryRate: number
}

async function getCitationStats(): Promise<CitationStats> {
  // Get all citations for the patch
  const patch = await prisma.patch.findUnique({
    where: { handle: PATCH_HANDLE },
    select: { id: true, title: true }
  })

  if (!patch) {
    throw new Error(`Patch "${PATCH_HANDLE}" not found`)
  }

  const allCitationsRaw = await prisma.wikipediaCitation.findMany({
    where: {
      monitoring: {
        patchId: patch.id
      }
    },
    select: {
      id: true,
      citationUrl: true,
      lastScannedAt: true,
      aiPriorityScore: true,
      relevanceDecision: true,
      scanStatus: true,
      createdAt: true
    }
  })
  
  // Filter out null citation URLs
  const allCitations = allCitationsRaw.filter(c => c.citationUrl !== null)

  const total = allCitations.length
  const scanned = allCitations.filter(c => c.scanStatus === 'scanned').length
  const notScanned = allCitations.filter(c => c.scanStatus === 'not_scanned').length
  const scanning = allCitations.filter(c => c.scanStatus === 'scanning').length
  const scannedPercentage = total > 0 ? (scanned / total) * 100 : 0

  // Relevance scoring
  const withRelevanceScore = allCitations.filter(c => c.aiPriorityScore !== null).length
  const withoutRelevanceScore = scanned - withRelevanceScore
  const scores = allCitations.filter(c => c.aiPriorityScore !== null).map(c => c.aiPriorityScore!)
  const avgRelevanceScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null

  const savedCount = allCitations.filter(c => c.relevanceDecision === 'saved').length
  const deniedCount = allCitations.filter(c => c.relevanceDecision === 'denied').length
  const noDecisionCount = scanned - savedCount - deniedCount

  // Get saved content
  const savedContent = await prisma.discoveredContent.findMany({
    where: {
      patchId: patch.id,
      category: 'wikipedia_citation'
    },
    select: {
      id: true,
      canonicalUrl: true,
      textContent: true,
      lastCrawledAt: true
    }
  })

  const savedContentTotal = savedContent.length

  // Match citations to saved content by URL
  const savedUrls = new Set(savedContent.map(s => s.canonicalUrl?.toLowerCase()).filter(Boolean))
  const savedFromCitations = allCitations.filter(c => {
    if (!c.citationUrl) return false
    return savedUrls.has(c.citationUrl.toLowerCase())
  }).length

  const savedFromScanned = savedCount
  const savedFromRelevant = withRelevanceScore > 0 ? savedCount : 0
  const saveRateFromScanned = scanned > 0 ? (savedCount / scanned) * 100 : 0
  const saveRateFromRelevant = withRelevanceScore > 0 ? (savedCount / withRelevanceScore) * 100 : 0
  
  // Fix: scanned count should be based on scanStatus, not lastScannedAt
  const actuallyScanned = allCitations.filter(c => c.scanStatus === 'scanned').length

  // Extraction
  const extractedCount = savedContent.filter(s => s.textContent !== null && s.textContent.length > 0).length
  const extractedPercentage = savedContentTotal > 0 ? (extractedCount / savedContentTotal) * 100 : 0

  // Agent memories
  const agentMemories = await prisma.agentMemory.findMany({
    where: {
      discoveredContent: {
        patchId: patch.id
      },
      discoveredContentId: { in: savedContent.map(s => s.id) }
    },
    select: { id: true, discoveredContentId: true }
  })

  const agentMemoriesCount = agentMemories.length
  const agentMemoriesFromSaved = agentMemories.length
  const agentMemoryRate = savedContentTotal > 0 ? (agentMemoriesCount / savedContentTotal) * 100 : 0

  return {
    total,
    scanned,
    notScanned,
    scannedPercentage,
    withRelevanceScore,
    withoutRelevanceScore,
    avgRelevanceScore,
    savedCount,
    deniedCount,
    noDecisionCount,
    savedFromScanned,
    savedFromRelevant,
    saveRateFromScanned,
    saveRateFromRelevant,
    savedContentTotal,
    savedFromCitations,
    extractedCount,
    extractedPercentage,
    agentMemoriesCount,
    agentMemoriesFromSaved,
    agentMemoryRate
  }
}

async function checkDiscoveryRunStatus() {
  const patch = await prisma.patch.findUnique({
    where: { handle: PATCH_HANDLE },
    select: { id: true }
  })

  if (!patch) return null

  const latestRun = await prisma.discoveryRun.findFirst({
    where: { patchId: patch.id },
    orderBy: { startedAt: 'desc' },
    select: {
      id: true,
      status: true,
      startedAt: true,
      completedAt: true,
      metrics: true
    }
  })

  return latestRun
}

async function checkRelevanceThreshold() {
  // Check what the relevance threshold is for saving
  const codebaseSearch = await import('@/lib/discovery/relevanceEngine')
  // Let's check the actual code to see what threshold is used
  return null
}

async function checkUnsavedHighRelevance() {
  const patch = await prisma.patch.findUnique({
    where: { handle: PATCH_HANDLE },
    select: { id: true }
  })

  if (!patch) return []

  // Find citations with high relevance scores but not saved
  const highRelevanceUnsavedRaw = await prisma.wikipediaCitation.findMany({
    where: {
      monitoring: {
        patchId: patch.id
      },
      aiPriorityScore: { gte: 50 }, // High relevance
      relevanceDecision: { not: 'saved' },
      scanStatus: 'scanned'
    },
    select: {
      id: true,
      citationUrl: true,
      aiPriorityScore: true,
      relevanceDecision: true,
      lastScannedAt: true
    },
    take: 20,
    orderBy: { aiPriorityScore: 'desc' }
  })

  return highRelevanceUnsavedRaw
}

async function checkAgentMemoryFeedQueue() {
  const patch = await prisma.patch.findUnique({
    where: { handle: PATCH_HANDLE },
    select: { id: true }
  })

  if (!patch) return null

  const savedContent = await prisma.discoveredContent.findMany({
    where: {
      patchId: patch.id,
      category: 'wikipedia_citation'
    },
    select: { id: true }
  })

  const contentIds = savedContent.map(s => s.id)

  const feedQueueItems = await prisma.agentMemoryFeedQueue.findMany({
    where: {
      contentId: { in: contentIds }
    },
    select: {
      id: true,
      contentId: true,
      status: true,
      enqueuedAt: true,
      processedAt: true,
      error: true
    }
  })

  const feedQueueStats = {
    total: feedQueueItems.length,
    pending: feedQueueItems.filter(q => q.status === 'PENDING').length,
    done: feedQueueItems.filter(q => q.status === 'DONE').length,
    error: feedQueueItems.filter(q => q.status === 'ERROR').length,
    withError: feedQueueItems.filter(q => q.error !== null).length
  }

  return {
    feedQueueItems,
    feedQueueStats,
    savedContentCount: savedContent.length
  }
}

async function main() {
  console.log('\n🔍 FULL CITATIONS AUDIT\n')
  console.log(`Patch: ${PATCH_HANDLE}\n`)

  // Get citation stats
  console.log('📊 Gathering citation statistics...\n')
  const stats = await getCitationStats()

  console.log('='.repeat(80))
  console.log('QUESTION 1: Are we done finding all citations?\n')
  console.log(`Total Citations: ${stats.total.toLocaleString()}`)
  console.log(`Scanned: ${stats.scanned.toLocaleString()} (${stats.scannedPercentage.toFixed(1)}%)`)
  console.log(`Not Scanned: ${stats.notScanned.toLocaleString()} (${(100 - stats.scannedPercentage).toFixed(1)}%)`)
  
  if (stats.notScanned > 0) {
    console.log(`\n❌ NO - We have ${stats.notScanned.toLocaleString()} citations that haven't been scanned yet.`)
    console.log(`   This means the discovery engine hasn't processed all citations yet.`)
  } else {
    console.log(`\n✅ YES - All citations have been scanned.`)
  }

  console.log('\n' + '='.repeat(80))
  console.log('QUESTION 2: Why have we only saved 171?\n')
  console.log(`Scanned Citations: ${stats.scanned.toLocaleString()}`)
  console.log(`Citations with Relevance Score: ${stats.withRelevanceScore.toLocaleString()}`)
  console.log(`Citations without Relevance Score: ${stats.withoutRelevanceScore.toLocaleString()}`)
  console.log(`\nRelevance Decisions:`)
  console.log(`  - Saved: ${stats.savedCount.toLocaleString()}`)
  console.log(`  - Denied: ${stats.deniedCount.toLocaleString()}`)
  console.log(`  - No Decision: ${stats.noDecisionCount.toLocaleString()}`)
  
  if (stats.avgRelevanceScore !== null) {
    console.log(`\nAverage Relevance Score: ${stats.avgRelevanceScore.toFixed(1)}`)
  }
  
  console.log(`\nSave Rates:`)
  console.log(`  - From Scanned: ${stats.saveRateFromScanned.toFixed(1)}% (${stats.savedCount}/${stats.scanned})`)
  console.log(`  - From Relevant: ${stats.saveRateFromRelevant.toFixed(1)}% (${stats.savedCount}/${stats.withRelevanceScore})`)
  
  console.log(`\nSaved Content in DB: ${stats.savedContentTotal.toLocaleString()}`)
  console.log(`Matched to Citations: ${stats.savedFromCitations.toLocaleString()}`)
  
  // Check for high relevance unsaved
  console.log(`\n🔍 Checking for high-relevance citations that weren't saved...`)
  const highRelevanceUnsaved = await checkUnsavedHighRelevance()
  if (highRelevanceUnsaved.length > 0) {
    console.log(`\n⚠️  Found ${highRelevanceUnsaved.length} citations with score ≥50 that weren't saved:`)
    highRelevanceUnsaved.slice(0, 10).forEach((c, i) => {
      console.log(`  ${i + 1}. Score: ${c.relevanceScore?.toFixed(1)}, Decision: ${c.relevanceDecision || 'null'}, URL: ${c.citationUrl?.substring(0, 60)}...`)
    })
  }

  console.log('\n' + '='.repeat(80))
  console.log('QUESTION 3: Why are agent memories not the same as saved items?\n')
  console.log(`Saved Content: ${stats.savedContentTotal.toLocaleString()}`)
  console.log(`Agent Memories: ${stats.agentMemoriesCount.toLocaleString()}`)
  console.log(`Agent Memory Rate: ${stats.agentMemoryRate.toFixed(1)}%`)
  console.log(`Missing: ${stats.savedContentTotal - stats.agentMemoriesCount} memories`)
  
  // Check feed queue
  console.log(`\n🔍 Checking AgentMemoryFeedQueue...`)
  const feedQueueData = await checkAgentMemoryFeedQueue()
  if (feedQueueData) {
    console.log(`\nFeed Queue Stats:`)
    console.log(`  - Total Items: ${feedQueueData.feedQueueStats.total}`)
    console.log(`  - Pending: ${feedQueueData.feedQueueStats.pending}`)
    console.log(`  - Done: ${feedQueueData.feedQueueStats.done}`)
    console.log(`  - Error: ${feedQueueData.feedQueueStats.error}`)
    console.log(`  - With Errors: ${feedQueueData.feedQueueStats.withError}`)
    console.log(`\nSaved Content Count: ${feedQueueData.savedContentCount}`)
    
    if (feedQueueData.feedQueueStats.total < feedQueueData.savedContentCount) {
      console.log(`\n⚠️  ISSUE: Feed queue has fewer items (${feedQueueData.feedQueueStats.total}) than saved content (${feedQueueData.savedContentCount})`)
      console.log(`   This means some saved content was never enqueued for agent learning.`)
    }
    
    if (feedQueueData.feedQueueStats.pending > 0) {
      console.log(`\n⚠️  ISSUE: ${feedQueueData.feedQueueStats.pending} items are still pending in the feed queue.`)
      console.log(`   The agent feed processor may not be running or is stuck.`)
    }
    
    if (feedQueueData.feedQueueStats.error > 0) {
      console.log(`\n⚠️  ISSUE: ${feedQueueData.feedQueueStats.error} items failed processing.`)
      const errorItems = feedQueueData.feedQueueItems.filter(q => q.status === 'ERROR').slice(0, 5)
      errorItems.forEach(q => {
        console.log(`   - Content ID: ${q.contentId}, Error: ${q.error?.substring(0, 100)}`)
      })
    }
  }

  // Check discovery run status
  console.log('\n' + '='.repeat(80))
  console.log('DISCOVERY RUN STATUS\n')
  const latestRun = await checkDiscoveryRunStatus()
  if (latestRun) {
    console.log(`Latest Run ID: ${latestRun.id}`)
    console.log(`Status: ${latestRun.status}`)
    console.log(`Started: ${latestRun.startedAt?.toISOString()}`)
    console.log(`Completed: ${latestRun.completedAt?.toISOString() || 'Not completed'}`)
    if (latestRun.metrics) {
      console.log(`Metrics: ${JSON.stringify(latestRun.metrics, null, 2)}`)
    }
  } else {
    console.log('No discovery run found')
  }

  console.log('\n' + '='.repeat(80))
  console.log('\n✅ Audit Complete\n')
}

main().catch((error) => {
  console.error('❌ Error:', error)
  process.exit(1)
})

