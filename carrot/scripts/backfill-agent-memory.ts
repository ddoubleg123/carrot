/**
 * Backfill Agent Memory Script
 * 
 * Enqueues existing discovered content for agent feeding
 * 
 * Usage:
 *   ts-node scripts/backfill-agent-memory.ts --patch=handle --since=2024-01-01 --limit=100 --dry-run
 */

import 'dotenv/config'
import { prisma } from '../src/lib/prisma'
import { enqueueDiscoveredContent, calculateContentHash } from '../src/lib/agent/feedWorker'

interface Args {
  patch?: string
  since?: string
  limit?: number
  dryRun?: boolean
  resume?: boolean
}

async function parseArgs(): Promise<Args> {
  const args: Args = {}
  
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i]
    if (arg.startsWith('--patch=')) {
      args.patch = arg.split('=')[1]
    } else if (arg.startsWith('--since=')) {
      args.since = arg.split('=')[1]
    } else if (arg.startsWith('--limit=')) {
      args.limit = parseInt(arg.split('=')[1])
    } else if (arg === '--dry-run') {
      args.dryRun = true
    } else if (arg === '--resume') {
      args.resume = true
    }
  }
  
  return args
}

async function backfillAgentMemory(args: Args) {
  console.log('[Backfill] Starting agent memory backfill...')
  console.log('[Backfill] Args:', args)

  const where: any = {}

  // Filter by patch
  if (args.patch) {
    const patch = await prisma.patch.findUnique({
      where: { handle: args.patch },
      select: { id: true, title: true }
    })

    if (!patch) {
      console.error(`[Backfill] Patch not found: ${args.patch}`)
      process.exit(1)
    }

    where.patchId = patch.id
    console.log(`[Backfill] Patch: ${patch.title} (${patch.id})`)
  }

  // Filter by date
  if (args.since) {
    where.createdAt = { gte: new Date(args.since) }
    console.log(`[Backfill] Since: ${args.since}`)
  }

  // Quality gates
  const MIN_TEXT_BYTES = 600
  const MIN_RELEVANCE = 60

  // Find discovered content
  const discoveredContent = await prisma.discoveredContent.findMany({
    where,
    select: {
      id: true,
      patchId: true,
      title: true,
      summary: true,
      textContent: true,
      contentHash: true,
      relevanceScore: true,
      qualityScore: true,
      createdAt: true
    },
    orderBy: { createdAt: 'desc' },
    take: args.limit || 1000
  })

  console.log(`[Backfill] Found ${discoveredContent.length} items to process`)

  let enqueued = 0
  let skipped = 0
  let failed = 0

  for (let i = 0; i < discoveredContent.length; i++) {
    const content = discoveredContent[i]
    
    if (i % 10 === 0) {
      console.log(`[Backfill] Progress: ${i}/${discoveredContent.length} (enqueued: ${enqueued}, skipped: ${skipped}, failed: ${failed})`)
    }

    // Check quality gates
    const textBytes = (content.textContent || content.summary || '').length
    if (textBytes < MIN_TEXT_BYTES) {
      skipped++
      continue
    }

    if (content.relevanceScore < MIN_RELEVANCE) {
      skipped++
      continue
    }

    // Check if already processed
    const contentHash = content.contentHash || calculateContentHash(
      content.title,
      content.summary,
      content.textContent
    )

    const existingMemory = await prisma.agentMemory.findUnique({
      where: {
        patchId_discoveredContentId_contentHash: {
          patchId: content.patchId,
          discoveredContentId: content.id,
          contentHash
        }
      }
    })

    if (existingMemory) {
      skipped++
      continue
    }

    // Check if already enqueued
    const existingQueue = await prisma.agentMemoryFeedQueue.findUnique({
      where: {
        patchId_discoveredContentId_contentHash: {
          patchId: content.patchId,
          discoveredContentId: content.id,
          contentHash
        }
      }
    })

    if (existingQueue) {
      skipped++
      continue
    }

    // Enqueue
    if (!args.dryRun) {
      const result = await enqueueDiscoveredContent(
        content.id,
        content.patchId,
        contentHash,
        0
      )

      if (result.enqueued) {
        enqueued++
      } else {
        failed++
        console.warn(`[Backfill] Failed to enqueue ${content.id}: ${result.reason}`)
      }
    } else {
      enqueued++ // Count as would-be enqueued
      console.log(`[Backfill] [DRY RUN] Would enqueue: ${content.title.substring(0, 50)}...`)
    }
  }

  console.log('\n[Backfill] Summary:')
  console.log(`  Enqueued: ${enqueued}`)
  console.log(`  Skipped: ${skipped}`)
  console.log(`  Failed: ${failed}`)
  console.log(`  Total: ${discoveredContent.length}`)

  if (args.dryRun) {
    console.log('\n[Backfill] DRY RUN - no changes made')
  }
}

async function main() {
  try {
    const args = await parseArgs()
    await backfillAgentMemory(args)
  } catch (error) {
    console.error('[Backfill] Error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()

