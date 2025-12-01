/**
 * Check if agents exist for a patch
 * Run with: npx tsx scripts/check-agents.ts chicago-bulls
 */

import { prisma } from '../src/lib/prisma'

async function checkAgents(patchHandle: string) {
  const agents = await prisma.agent.findMany({
    where: {
      associatedPatches: { has: patchHandle },
      isActive: true
    },
    select: {
      id: true,
      name: true,
      associatedPatches: true,
      isActive: true
    }
  })

  console.log(`\n🤖 Agents for patch "${patchHandle}":\n`)
  
  if (agents.length === 0) {
    console.log('  ❌ No active agents found for this patch')
    console.log('  → This is why citations are not being saved to AgentMemory')
    console.log('  → Solution: Create an agent and associate it with this patch')
  } else {
    console.log(`  ✅ Found ${agents.length} active agent(s):\n`)
    agents.forEach((agent, i) => {
      console.log(`  ${i + 1}. ${agent.name || 'Unnamed Agent'}`)
      console.log(`     ID: ${agent.id}`)
      console.log(`     Associated patches: ${agent.associatedPatches.join(', ')}`)
      console.log(`     Active: ${agent.isActive}\n`)
    })
  }

  await prisma.$disconnect()
}

const patchHandle = process.argv[2]
if (!patchHandle) {
  console.error('Usage: npx tsx scripts/check-agents.ts [patchHandle]')
  process.exit(1)
}

checkAgents(patchHandle).catch(console.error)

