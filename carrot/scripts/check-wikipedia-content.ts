/**
 * Check Wikipedia citation content in database
 * Run with: npx tsx scripts/check-wikipedia-content.ts chicago-bulls
 */

import { prisma } from '../src/lib/prisma'

async function checkWikipediaContent(patchHandle: string) {
  const patch = await prisma.patch.findUnique({
    where: { handle: patchHandle },
    select: { id: true, handle: true, title: true }
  })

  if (!patch) {
    console.error(`Patch "${patchHandle}" not found`)
    process.exit(1)
  }

  console.log(`\n📊 Wikipedia Citation Content Status for: ${patch.title}\n`)

  // Check DiscoveredContent
  const wikipediaContent = await prisma.discoveredContent.findMany({
    where: {
      patchId: patch.id,
      category: 'wikipedia_citation'
    },
    select: {
      id: true,
      title: true,
      isUseful: true,
      createdAt: true,
      sourceUrl: true
    },
    take: 10,
    orderBy: { createdAt: 'desc' }
  })

  const totalContent = await prisma.discoveredContent.count({
    where: {
      patchId: patch.id,
      category: 'wikipedia_citation'
    }
  })

  console.log(`DiscoveredContent (wikipedia_citation):`)
  console.log(`  Total: ${totalContent}`)
  console.log(`  Recent items (last 10):`)
  wikipediaContent.forEach((c, i) => {
    console.log(`    ${i + 1}. ${c.title}`)
    console.log(`       URL: ${c.sourceUrl}`)
    console.log(`       Useful: ${c.isUseful}`)
    console.log(`       Created: ${c.createdAt.toISOString()}\n`)
  })

  // Check AgentMemory
  const agentMemories = await prisma.agentMemory.findMany({
    where: {
      sourceType: 'wikipedia_citation',
      tags: { has: patchHandle }
    },
    select: {
      id: true,
      sourceTitle: true,
      sourceUrl: true,
      createdAt: true,
      tags: true
    },
    take: 10,
    orderBy: { createdAt: 'desc' }
  })

  const totalMemories = await prisma.agentMemory.count({
    where: {
      sourceType: 'wikipedia_citation',
      tags: { has: patchHandle }
    }
  })

  console.log(`\nAgentMemory (wikipedia_citation):`)
  console.log(`  Total: ${totalMemories}`)
  console.log(`  Recent items (last 10):`)
  agentMemories.forEach((m, i) => {
    console.log(`    ${i + 1}. ${m.sourceTitle || 'Untitled'}`)
    console.log(`       URL: ${m.sourceUrl}`)
    console.log(`       Tags: ${m.tags.join(', ')}`)
    console.log(`       Created: ${m.createdAt.toISOString()}\n`)
  })

  // Check citations status
  const citations = await prisma.wikipediaCitation.findMany({
    where: {
      monitoring: { patchId: patch.id },
      savedContentId: { not: null }
    },
    select: {
      id: true,
      citationTitle: true,
      savedContentId: true,
      savedMemoryId: true,
      verificationStatus: true,
      scanStatus: true
    },
    take: 10,
    orderBy: { createdAt: 'desc' }
  })

  const totalSavedCitations = await prisma.wikipediaCitation.count({
    where: {
      monitoring: { patchId: patch.id },
      savedContentId: { not: null }
    }
  })

  console.log(`\nWikipedia Citations with saved content:`)
  console.log(`  Total: ${totalSavedCitations}`)
  console.log(`  Sample (last 10):`)
  citations.forEach((c, i) => {
    console.log(`    ${i + 1}. ${c.citationTitle || 'Untitled'}`)
    console.log(`       Content ID: ${c.savedContentId}`)
    console.log(`       Memory ID: ${c.savedMemoryId || 'none'}`)
    console.log(`       Status: ${c.verificationStatus}/${c.scanStatus}\n`)
  })

  await prisma.$disconnect()
}

const patchHandle = process.argv[2]
if (!patchHandle) {
  console.error('Usage: npx tsx scripts/check-wikipedia-content.ts [patchHandle]')
  process.exit(1)
}

checkWikipediaContent(patchHandle).catch(console.error)

