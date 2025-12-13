/**
 * Feed ALL Discovered Content to Agent (Direct - No Queue)
 * 
 * Feeds discovered content directly to agent without using queue
 * For immediate learning without waiting for migration
 * 
 * Usage:
 *   ts-node scripts/feed-all-discovered-content-direct.ts --patch=israel
 */

import 'dotenv/config'
import { prisma } from '../src/lib/prisma'
import { AgentRegistry } from '../src/lib/ai-agents/agentRegistry'
import { FeedService, FeedItem } from '../src/lib/ai-agents/feedService'
import { packDiscoveredContent } from '../src/lib/agent/packers'

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

async function feedAllDiscoveredContentDirect(patchHandle: string, dryRun: boolean = false) {
  console.log(`\n🚀 Feeding ALL discovered content directly to agent: ${patchHandle}\n`)

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
    process.exit(1)
  }

  const agent = agents[0]
  console.log(`🤖 Agent: ${agent.name} (${agent.id})\n`)

  // Get ALL discovered content (NO LIMITS)
  const allDiscoveredContent = await prisma.discoveredContent.findMany({
    where: { patchId: patch.id },
    select: {
      id: true,
      title: true,
      summary: true,
      whyItMatters: true,
      facts: true,
      keyFacts: true,
      textContent: true,
      sourceUrl: true,
      domain: true,
      publishDate: true,
      metadata: true
    },
    orderBy: { createdAt: 'desc' }
  })

  console.log(`📰 Found ${allDiscoveredContent.length} discovered content items\n`)

  // Get existing memories to check for duplicates
  const existingMemories = await prisma.agentMemory.findMany({
    where: { 
      agentId: agent.id,
      sourceType: 'discovery'
    },
    select: {
      sourceUrl: true,
      sourceTitle: true
    }
  })

  const existingUrls = new Set(existingMemories.map(m => m.sourceUrl).filter(Boolean))
  const existingTitles = new Set(existingMemories.map(m => m.sourceTitle).filter(Boolean))

  let fed = 0
  let skipped = 0
  let failed = 0

  console.log('🔄 Feeding content directly to agent...\n')

  for (let i = 0; i < allDiscoveredContent.length; i++) {
    const content = allDiscoveredContent[i]
    
    if (i % 10 === 0 && i > 0) {
      console.log(`   Progress: ${i}/${allDiscoveredContent.length} (fed: ${fed}, skipped: ${skipped}, failed: ${failed})`)
    }

    // Check if already learned (by URL or title)
    if (content.sourceUrl && existingUrls.has(content.sourceUrl)) {
      skipped++
      continue
    }
    if (content.title && existingTitles.has(content.title)) {
      skipped++
      continue
    }

    // Pack content
    try {
      const packed = await packDiscoveredContent({
        id: content.id,
        title: content.title,
        summary: content.summary,
        whyItMatters: content.whyItMatters,
        facts: content.facts,
        keyFacts: content.keyFacts as any,
        textContent: content.textContent,
        sourceUrl: content.sourceUrl,
        publishDate: content.publishDate,
        domain: content.domain,
        metadata: content.metadata as any
      })

      // Build memory content
      const memoryContent = buildMemoryContent(packed, content)

      if (!dryRun) {
        // Feed directly to agent
        const feedItem: FeedItem = {
          content: memoryContent,
          sourceType: 'discovery',
          sourceUrl: content.sourceUrl,
          sourceTitle: content.title,
          sourceAuthor: content.domain || undefined,
          tags: ['discovery', 'israel'],
          threadId: content.id,
          topicId: patch.id
        }

        try {
          await FeedService.feedAgent(agent.id, feedItem, 'auto-discovery-backfill')
          fed++
          console.log(`   ✅ Fed: ${content.title.substring(0, 50)}...`)
        } catch (error) {
          failed++
          console.error(`   ❌ Failed: ${content.title.substring(0, 50)}... - ${error instanceof Error ? error.message : String(error)}`)
        }
      } else {
        fed++ // Count as would-be fed
        if (fed <= 10) {
          console.log(`   [DRY RUN] Would feed: ${content.title.substring(0, 60)}...`)
        }
      }
    } catch (error) {
      failed++
      console.error(`   ❌ Error packing content ${content.id}:`, error)
    }
  }

  console.log('\n📊 Summary:')
  console.log(`   ✅ Fed: ${fed}`)
  console.log(`   ⏭️  Skipped (already learned): ${skipped}`)
  console.log(`   ❌ Failed: ${failed}`)
  console.log(`   📦 Total: ${allDiscoveredContent.length}\n`)

  if (dryRun) {
    console.log('💡 DRY RUN - no changes made. Remove --dry-run to actually feed.\n')
  } else {
    console.log('✅ Content fed directly to agent!\n')
  }
}

function buildMemoryContent(
  packed: {
    title: string
    summary: string
    facts: Array<{ text: string; date?: string }>
    entities: Array<{ name: string; type: string }>
    timeline: Array<{ date: string; what: string; refs: string[] }>
  },
  content: { sourceUrl: string; publishDate?: Date | null; domain?: string | null }
): string {
  const parts: string[] = []

  parts.push(`Title: ${packed.title}`)
  if (content.publishDate) {
    parts.push(`Published: ${content.publishDate.toISOString().split('T')[0]}`)
  }
  if (content.domain) {
    parts.push(`Source: ${content.domain}`)
  }
  parts.push(`URL: ${content.sourceUrl}`)
  parts.push('')

  if (packed.summary) {
    parts.push('Summary:')
    parts.push(packed.summary)
    parts.push('')
  }

  if (packed.facts.length > 0) {
    parts.push('Key Facts:')
    for (const fact of packed.facts) {
      const factText = fact.date ? `${fact.text} (${fact.date})` : fact.text
      parts.push(`- ${factText}`)
    }
    parts.push('')
  }

  if (packed.entities.length > 0) {
    parts.push('Entities:')
    for (const entity of packed.entities.slice(0, 10)) {
      parts.push(`- ${entity.name} (${entity.type})`)
    }
    parts.push('')
  }

  if (packed.timeline.length > 0) {
    parts.push('Timeline:')
    for (const item of packed.timeline) {
      parts.push(`- ${item.date}: ${item.what}`)
    }
  }

  return parts.join('\n')
}

async function main() {
  try {
    const args = await parseArgs()
    const patchHandle = args.patch || 'israel'
    
    await feedAllDiscoveredContentDirect(patchHandle, args.dryRun || false)
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()

