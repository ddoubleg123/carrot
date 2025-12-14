/**
 * Feed ALL Discovered Content to Agent
 * 
 * Comprehensive backfill that feeds ALL discovered content to the patch agent
 * No limits - feeds everything the agent hasn't learned yet
 * 
 * Usage:
 *   ts-node scripts/feed-all-discovered-content.ts --patch=israel
 */

import 'dotenv/config'
import { prisma } from '../src/lib/prisma'
import { AgentRegistry } from '../src/lib/ai-agents/agentRegistry'
import { enqueueDiscoveredContent, calculateContentHash } from '../src/lib/agent/feedWorker'

interface Args {
  patch?: string
  dryRun?: boolean
}

async function parseArgs(): Promise<Args> {
  const args: Args = {}
  
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i]
    if (arg.startsWith('--patch=')) {
      args.patch = arg.split('=')[1]
    } else if (arg === '--dry-run') {
      args.dryRun = true
    }
  }
  
  return args
}

async function feedAllDiscoveredContent(patchHandle: string, dryRun: boolean = false) {
  console.log(`\n🚀 Feeding ALL discovered content to agent for patch: ${patchHandle}\n`)

  // Get patch
  const patch = await prisma.patch.findUnique({
    where: { handle: patchHandle },
    select: {
      id: true,
      title: true
    }
  })

  if (!patch) {
    console.error(`❌ Patch not found: ${patchHandle}`)
    process.exit(1)
  }

  console.log(`📋 Patch: ${patch.title} (${patch.id})\n`)

  // Get agent
  const agents = await AgentRegistry.getAgentsByPatches([patchHandle])
  if (agents.length === 0) {
    console.error(`❌ No agent found for patch: ${patchHandle}`)
    console.log(`💡 Agent should have been auto-created. Check patch creation.`)
    process.exit(1)
  }

  const agent = agents[0]
  console.log(`🤖 Agent: ${agent.name} (${agent.id})\n`)

  // Get ALL discovered content for this patch (NO LIMITS)
  const allDiscoveredContent = await prisma.discoveredContent.findMany({
    where: { patchId: patch.id },
    select: {
      id: true,
      title: true,
      summary: true,
      textContent: true,
      contentHash: true,
      relevanceScore: true,
      qualityScore: true,
      sourceUrl: true,
      createdAt: true
    },
    orderBy: { createdAt: 'desc' }
  })

  console.log(`📰 Found ${allDiscoveredContent.length} discovered content items\n`)

  // Quality gates (very lenient - only filter obvious junk)
  const MIN_TEXT_BYTES = 50 // Very low threshold - include almost everything
  const MIN_RELEVANCE = 0 // No minimum - learn everything

  let enqueued = 0
  let skipped = 0
  let failed = 0
  let alreadyProcessed = 0

  console.log('🔄 Processing content...\n')

  for (let i = 0; i < allDiscoveredContent.length; i++) {
    const content = allDiscoveredContent[i]
    
    if (i % 50 === 0 && i > 0) {
      console.log(`   Progress: ${i}/${allDiscoveredContent.length} (enqueued: ${enqueued}, skipped: ${skipped}, failed: ${failed}, already processed: ${alreadyProcessed})`)
    }

    // Basic quality check (very lenient - only filter obvious junk)
    const textBytes = (content.textContent || content.summary || '').length
    if (textBytes < MIN_TEXT_BYTES) {
      skipped++
      if (skipped <= 5) {
        console.log(`   ⏭️  Skipping ${content.id}: text too short (${textBytes} bytes)`)
      }
      continue
    }

    if (content.relevanceScore < MIN_RELEVANCE) {
      skipped++
      if (skipped <= 5) {
        console.log(`   ⏭️  Skipping ${content.id}: relevance too low (${content.relevanceScore})`)
      }
      continue
    }

    // Calculate content hash
    const contentHash = content.contentHash || calculateContentHash(
      content.title,
      content.summary,
      content.textContent
    )

    // Check if already processed
    const existingMemory = await prisma.agentMemory.findUnique({
      where: {
        patchId_discoveredContentId_contentHash: {
          patchId: patch.id,
          discoveredContentId: content.id,
          contentHash
        }
      }
    })

    if (existingMemory) {
      alreadyProcessed++
      continue
    }

    // Check if already enqueued
    try {
      const existingQueue = await (prisma as any).agentMemoryFeedQueue.findUnique({
        where: {
          patchId_discoveredContentId_contentHash: {
            patchId: patch.id,
            discoveredContentId: content.id,
            contentHash
          }
        }
      })

      if (existingQueue) {
        alreadyProcessed++
        continue
      }
    } catch (error) {
      // Table might not exist yet - continue
    }

    // Enqueue for processing
    if (!dryRun) {
      const result = await enqueueDiscoveredContent(
        content.id,
        patch.id,
        contentHash,
        0 // Default priority
      )

      if (result.enqueued) {
        enqueued++
      } else {
        failed++
        if (failed <= 10) { // Only log first 10 failures
          console.warn(`   ⚠️  Failed to enqueue ${content.id}: ${result.reason}`)
        }
      }
    } else {
      enqueued++ // Count as would-be enqueued
      if (enqueued <= 10) {
        console.log(`   [DRY RUN] Would enqueue: ${content.title.substring(0, 60)}...`)
      }
    }
  }

  console.log('\n📊 Summary:')
  console.log(`   ✅ Enqueued: ${enqueued}`)
  console.log(`   ⏭️  Skipped (low quality): ${skipped}`)
  console.log(`   ❌ Failed: ${failed}`)
  console.log(`   ✓ Already processed: ${alreadyProcessed}`)
  console.log(`   📦 Total: ${allDiscoveredContent.length}\n`)

  if (dryRun) {
    console.log('💡 DRY RUN - no changes made. Remove --dry-run to actually enqueue.\n')
  } else {
    console.log('✅ Content enqueued! The feed worker will process these items.\n')
    console.log('💡 To check status: GET /api/patches/israel/agent/health\n')
  }
}

async function main() {
  try {
    const args = await parseArgs()
    const patchHandle = args.patch || 'israel'
    
    await feedAllDiscoveredContent(patchHandle, args.dryRun || false)
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()

