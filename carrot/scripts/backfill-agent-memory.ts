#!/usr/bin/env tsx
/**
 * Backfill AgentMemory Entries
 * Links existing AgentMemory entries to DiscoveredContent by matching content/sourceUrl
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function backfillAgentMemory(patchHandle: string, dryRun: boolean = true) {
  const patch = await prisma.patch.findUnique({
    where: { handle: patchHandle },
    select: { id: true, title: true }
  })

  if (!patch) {
    console.error('Patch not found')
    process.exit(1)
  }

  // Find AgentMemory entries missing discovery fields
  const memories = await prisma.agentMemory.findMany({
    where: {
      OR: [
        { patchId: null },
        { discoveredContentId: null }
      ],
      sourceType: 'discovery'
    },
    select: {
      id: true,
      patchId: true,
      discoveredContentId: true,
      sourceUrl: true,
      sourceTitle: true,
      contentHash: true,
      content: true
    }
  })

  console.log(`\n📋 Found ${memories.length} AgentMemory entries missing discovery fields\n`)

  let updated = 0
  let notFound = 0

  for (const memory of memories) {
    // Try to find matching DiscoveredContent
    let discoveredContent = null

    // Method 1: Match by sourceUrl
    if (memory.sourceUrl) {
      discoveredContent = await prisma.discoveredContent.findFirst({
        where: {
          OR: [
            { sourceUrl: memory.sourceUrl },
            { canonicalUrl: memory.sourceUrl }
          ],
          patchId: patch.id
        },
        select: {
          id: true,
          title: true,
          sourceUrl: true
        }
      })
    }

    // Method 2: Match by contentHash if available
    if (!discoveredContent && memory.contentHash) {
      discoveredContent = await prisma.discoveredContent.findFirst({
        where: {
          contentHash: memory.contentHash,
          patchId: patch.id
        },
        select: {
          id: true,
          title: true,
          sourceUrl: true
        }
      })
    }

    // Method 3: Match by sourceTitle
    if (!discoveredContent && memory.sourceTitle) {
      discoveredContent = await prisma.discoveredContent.findFirst({
        where: {
          title: memory.sourceTitle,
          patchId: patch.id
        },
        select: {
          id: true,
          title: true,
          sourceUrl: true
        }
      })
    }

    if (discoveredContent) {
      console.log(`✅ Found match: "${discoveredContent.title}"`)
      console.log(`   Memory ID: ${memory.id}`)
      console.log(`   DiscoveredContent ID: ${discoveredContent.id}`)
      console.log(`   Updating: patchId=${patch.id}, discoveredContentId=${discoveredContent.id}\n`)

      if (!dryRun) {
        await prisma.agentMemory.update({
          where: { id: memory.id },
          data: {
            patchId: patch.id,
            discoveredContentId: discoveredContent.id
          }
        })
      }
      updated++
    } else {
      console.log(`⚠️  No match found for memory: ${memory.id}`)
      console.log(`   Source URL: ${memory.sourceUrl?.substring(0, 60) || 'N/A'}...`)
      console.log(`   Source Title: ${memory.sourceTitle || 'N/A'}\n`)
      notFound++
    }
  }

  console.log(`\n📊 Summary:`)
  console.log(`   Total memories: ${memories.length}`)
  console.log(`   Matched: ${updated}`)
  console.log(`   Not found: ${notFound}`)
  console.log(`   Mode: ${dryRun ? 'DRY RUN' : 'LIVE UPDATE'}\n`)

  if (dryRun) {
    console.log('💡 Run with --live to apply updates\n')
  }

  await prisma.$disconnect()
}

const args = process.argv.slice(2)
const patchHandle = args.find(arg => arg.startsWith('--patch='))?.split('=')[1] || 'israel'
const live = args.includes('--live')

backfillAgentMemory(patchHandle, !live)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })
