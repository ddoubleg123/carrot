/**
 * Backfill Agent Memory from Existing DiscoveredContent
 * 
 * Feeds all existing DiscoveredContent items to the Israel agent
 */

import 'dotenv/config'
import { prisma } from '../src/lib/prisma'
import { AgentRegistry } from '../src/lib/ai-agents/agentRegistry'
import { enqueueDiscoveredContent, calculateContentHash } from '../src/lib/agent/feedWorker'

async function backfill() {
  const patch = await prisma.patch.findUnique({
    where: { handle: 'israel' },
    select: { id: true, title: true }
  })

  if (!patch) {
    console.error('Patch not found')
    process.exit(1)
  }

  console.log(`\n🔄 Backfilling Agent Memory for ${patch.title}\n`)

  // Get or create agent
  let agents = await AgentRegistry.getAgentsByPatches([patch.id])
  
  if (agents.length === 0) {
    console.log('Creating agent...')
    const newAgent = await AgentRegistry.createAgent({
      name: `${patch.title} Agent`,
      persona: `You are an expert on ${patch.title}. You have deep knowledge about this topic.`,
      domainExpertise: [patch.title.toLowerCase()],
      associatedPatches: [patch.id]
    })
    agents = [newAgent]
  }

  const agent = agents[0]
  console.log(`✅ Using agent: ${agent.id} (${agent.name})\n`)

  // Get all DiscoveredContent for this patch
  const discoveredContent = await prisma.discoveredContent.findMany({
    where: { patchId: patch.id },
    select: {
      id: true,
      title: true,
      summary: true,
      textContent: true,
      sourceUrl: true,
      contentHash: true
    }
  })

  console.log(`📊 Found ${discoveredContent.length} DiscoveredContent items\n`)

  let enqueued = 0
  let skipped = 0
  let failed = 0

  for (const content of discoveredContent) {
    try {
      const contentHash = content.contentHash || calculateContentHash(
        content.title,
        content.summary,
        content.textContent
      )

      // Skip check for now - just enqueue everything
      // (The feed worker will handle idempotency)

      // Enqueue for agent feeding
      const result = await enqueueDiscoveredContent(
        content.id,
        patch.id,
        contentHash,
        0
      )

      if (result.enqueued) {
        enqueued++
        console.log(`   ✅ Enqueued: ${content.title.substring(0, 50)}...`)
      } else {
        skipped++
        console.log(`   ⏭️  Skipped: ${content.title.substring(0, 50)}... (${result.reason})`)
      }
    } catch (error) {
      failed++
      console.error(`   ❌ Failed: ${content.title.substring(0, 50)}...`, error)
    }
  }

  console.log(`\n📊 Summary:`)
  console.log(`   ✅ Enqueued: ${enqueued}`)
  console.log(`   ⏭️  Skipped: ${skipped}`)
  console.log(`   ❌ Failed: ${failed}`)
  console.log()
}

backfill()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

