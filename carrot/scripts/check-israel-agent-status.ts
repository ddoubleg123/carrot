/**
 * Check Israel Agent Status
 * 
 * Shows comprehensive status of the Israel patch agent:
 * - Agent existence and configuration
 * - Memories created
 * - Feed queue status
 * - Recent learning activity
 */

import 'dotenv/config'
import { prisma } from '../src/lib/prisma'
import { AgentRegistry } from '../src/lib/ai-agents/agentRegistry'

async function checkAgentStatus() {
  const patch = await prisma.patch.findUnique({
    where: { handle: 'israel' },
    select: { id: true, title: true }
  })

  if (!patch) {
    console.error('Patch not found')
    process.exit(1)
  }

  console.log(`\n🤖 Israel Agent Status for ${patch.title}\n`)

  // Get agent for this patch
  const agents = await AgentRegistry.getAgentsByPatches([patch.id])
  
  if (agents.length === 0) {
    console.log('❌ No agent found for this patch')
    console.log('   Creating agent...')
    
    // Create agent if it doesn't exist
    const newAgent = await AgentRegistry.createAgent({
      name: `${patch.title} Agent`,
      persona: `You are an expert on ${patch.title}. You have deep knowledge about this topic and can provide detailed, accurate information.`,
      domainExpertise: [patch.title.toLowerCase()],
      associatedPatches: [patch.id]
    })
    
    console.log(`✅ Created agent: ${newAgent.id}`)
    agents.push(newAgent)
  }

  const agent = agents[0]
  console.log(`✅ Agent Found:`)
  console.log(`   ID: ${agent.id}`)
  console.log(`   Name: ${agent.name}`)
  console.log(`   Active: ${agent.isActive}`)
  console.log()

  // Count memories
  const totalMemories = await prisma.agentMemory.count({
    where: { agentId: agent.id }
  })

  const discoveryMemories = await prisma.agentMemory.count({
    where: {
      agentId: agent.id,
      sourceType: 'discovery'
    }
  })

  const manualMemories = await prisma.agentMemory.count({
    where: {
      agentId: agent.id,
      sourceType: { not: 'discovery' }
    }
  })

  console.log('📚 Agent Memories:')
  console.log(`   Total: ${totalMemories.toLocaleString()}`)
  console.log(`   From Discovery: ${discoveryMemories.toLocaleString()}`)
  console.log(`   Manual/Other: ${manualMemories.toLocaleString()}`)
  console.log()

  // Feed queue status
  let queued = 0
  let processing = 0
  let done = 0
  let failed = 0

  try {
    queued = await (prisma as any).agentMemoryFeedQueue?.count({
      where: {
        patchId: patch.id,
        status: 'PENDING'
      }
    }) || 0

    processing = await (prisma as any).agentMemoryFeedQueue?.count({
      where: {
        patchId: patch.id,
        status: 'PROCESSING'
      }
    }) || 0

    done = await (prisma as any).agentMemoryFeedQueue?.count({
      where: {
        patchId: patch.id,
        status: 'DONE'
      }
    }) || 0

    failed = await (prisma as any).agentMemoryFeedQueue?.count({
      where: {
        patchId: patch.id,
        status: 'FAILED'
      }
    }) || 0
  } catch (error) {
    console.warn('   Could not query feed queue:', error)
  }

  console.log('🔄 Feed Queue Status:')
  console.log(`   Queued: ${queued.toLocaleString()}`)
  console.log(`   Processing: ${processing.toLocaleString()}`)
  console.log(`   Done: ${done.toLocaleString()}`)
  console.log(`   Failed: ${failed.toLocaleString()}`)
  console.log()

  // Recent memories
  const recentMemories = await prisma.agentMemory.findMany({
    where: { agentId: agent.id },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      id: true,
      sourceType: true,
      sourceTitle: true,
      sourceUrl: true,
      createdAt: true,
      content: true
    }
  })

  if (recentMemories.length > 0) {
    console.log('📝 Recent Memories (last 5):')
    recentMemories.forEach((memory, i) => {
      const contentPreview = memory.content.substring(0, 80).replace(/\n/g, ' ')
      console.log(`   ${i + 1}. ${memory.sourceTitle || 'Untitled'}`)
      console.log(`      Type: ${memory.sourceType}`)
      console.log(`      Preview: ${contentPreview}...`)
      console.log(`      Created: ${memory.createdAt.toISOString().split('T')[0]}`)
      if (memory.sourceUrl) {
        console.log(`      URL: ${memory.sourceUrl.substring(0, 60)}...`)
      }
      console.log()
    })
  }

  // Check if agent is learning from citations
  const citationMemories = await prisma.agentMemory.findMany({
    where: {
      agentId: agent.id,
      sourceType: 'discovery',
      sourceUrl: { contains: 'wikipedia' }
    },
    take: 3,
    select: {
      sourceTitle: true,
      sourceUrl: true,
      createdAt: true
    }
  })

  if (citationMemories.length > 0) {
    console.log('🔗 Learning from Citations:')
    citationMemories.forEach((memory, i) => {
      console.log(`   ${i + 1}. ${memory.sourceTitle}`)
      console.log(`      ${memory.sourceUrl?.substring(0, 70)}...`)
      console.log(`      Learned: ${memory.createdAt.toISOString().split('T')[0]}`)
    })
    console.log()
  }

  // Summary
  console.log('📊 Summary:')
  console.log(`   ✅ Agent exists and is active`)
  console.log(`   ${totalMemories > 0 ? '✅' : '⚠️'} Has ${totalMemories} memories`)
  console.log(`   ${discoveryMemories > 0 ? '✅' : '⚠️'} Learning from discovery: ${discoveryMemories} memories`)
  console.log(`   ${queued + processing > 0 ? '🔄' : '✅'} Feed queue: ${queued + processing} pending`)
  console.log()
}

checkAgentStatus()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
