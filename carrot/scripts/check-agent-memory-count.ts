#!/usr/bin/env tsx
/**
 * Check Agent Memory Count
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { AgentRegistry } from '../src/lib/ai-agents/agentRegistry'

const prisma = new PrismaClient()

async function checkMemoryCount(patchHandle: string) {
  const patch = await prisma.patch.findUnique({
    where: { handle: patchHandle },
    select: { id: true, title: true }
  })

  if (!patch) {
    console.error(`Patch not found`)
    process.exit(1)
  }

  const agents = await AgentRegistry.getAgentsByPatches([patchHandle])
  if (agents.length === 0) {
    console.error(`No agent found`)
    process.exit(1)
  }

  const agent = agents[0]

  // Count all AgentMemory entries for this agent
  const allMemories = await prisma.agentMemory.count({
    where: { agentId: agent.id }
  })

  // Count discovery memories
  const discoveryMemories = await prisma.agentMemory.count({
    where: {
      agentId: agent.id,
      sourceType: 'discovery'
    }
  })

  // Count with discoveredContentId
  const withContentId = await prisma.agentMemory.count({
    where: {
      agentId: agent.id,
      sourceType: 'discovery',
      discoveredContentId: { not: null }
    }
  })

  // Count with patchId
  const withPatchId = await prisma.agentMemory.count({
    where: {
      agentId: agent.id,
      patchId: patch.id
    }
  })

  // Get sample entries
  const samples = await prisma.agentMemory.findMany({
    where: {
      agentId: agent.id,
      sourceType: 'discovery'
    },
    take: 5,
    select: {
      id: true,
      sourceTitle: true,
      discoveredContentId: true,
      patchId: true,
      createdAt: true
    }
  })

  console.log(`\nAgent: ${agent.name}`)
  console.log(`\nMemory Counts:`)
  console.log(`  Total: ${allMemories}`)
  console.log(`  SourceType='discovery': ${discoveryMemories}`)
  console.log(`  With discoveredContentId: ${withContentId}`)
  console.log(`  With patchId: ${withPatchId}`)

  console.log(`\nSample entries:`)
  samples.forEach((m, i) => {
    console.log(`  ${i + 1}. ${m.sourceTitle || 'Untitled'}`)
    console.log(`     discoveredContentId: ${m.discoveredContentId || 'null'}`)
    console.log(`     patchId: ${m.patchId || 'null'}`)
    console.log(`     createdAt: ${m.createdAt.toISOString()}`)
  })

  await prisma.$disconnect()
}

const args = process.argv.slice(2)
const patchHandle = args.find(arg => arg.startsWith('--patch='))?.split('=')[1] || 'israel'

checkMemoryCount(patchHandle)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })

