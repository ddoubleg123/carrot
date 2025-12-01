/**
 * Comprehensive audit of Wikipedia processing status
 * Run with: npx tsx scripts/audit-wikipedia-status.ts chicago-bulls
 */

import { prisma } from '../src/lib/prisma'

async function auditWikipediaStatus(patchHandle: string) {
  const patch = await prisma.patch.findUnique({
    where: { handle: patchHandle },
    select: { id: true, handle: true, title: true }
  })

  if (!patch) {
    console.error(`Patch "${patchHandle}" not found`)
    process.exit(1)
  }

  console.log(`\n📊 Wikipedia Processing Status Audit: ${patch.title}\n`)
  console.log('=' .repeat(60))

  // 1. Agent Status
  console.log('\n1️⃣  AGENT STATUS')
  const agents = await prisma.agent.findMany({
    where: {
      associatedPatches: { has: patchHandle },
      isActive: true
    },
    select: { id: true, name: true, associatedPatches: true }
  })
  if (agents.length > 0) {
    console.log(`   ✅ Agent connected: "${agents[0].name}" (${agents[0].id})`)
  } else {
    console.log(`   ❌ No agent connected - will auto-create on next save`)
  }

  // 2. Wikipedia Pages
  console.log('\n2️⃣  WIKIPEDIA PAGES')
  const pages = await prisma.wikipediaMonitoring.findMany({
    where: { patchId: patch.id },
    select: {
      id: true,
      wikipediaTitle: true,
      status: true,
      contentScanned: true,
      citationsExtracted: true,
      citationCount: true
    }
  })
  const completedPages = pages.filter(p => p.status === 'completed').length
  const pendingPages = pages.filter(p => p.status === 'pending').length
  console.log(`   Total pages: ${pages.length}`)
  console.log(`   Completed: ${completedPages}`)
  console.log(`   Pending: ${pendingPages}`)

  // 3. Citations
  console.log('\n3️⃣  CITATIONS')
  const totalCitations = await prisma.wikipediaCitation.count({
    where: { monitoring: { patchId: patch.id } }
  })
  const scannedCitations = await prisma.wikipediaCitation.count({
    where: {
      monitoring: { patchId: patch.id },
      scanStatus: 'scanned'
    }
  })
  const savedCitations = await prisma.wikipediaCitation.count({
    where: {
      monitoring: { patchId: patch.id },
      savedContentId: { not: null }
    }
  })
  console.log(`   Total citations: ${totalCitations}`)
  console.log(`   Scanned: ${scannedCitations}`)
  console.log(`   Saved to DiscoveredContent: ${savedCitations}`)

  // 4. DiscoveredContent (Frontend Display)
  console.log('\n4️⃣  DISCOVERED CONTENT (Frontend Display)')
  const discoveredContent = await prisma.discoveredContent.count({
    where: {
      patchId: patch.id,
      category: 'wikipedia_citation'
    }
  })
  const usefulContent = await prisma.discoveredContent.count({
    where: {
      patchId: patch.id,
      category: 'wikipedia_citation',
      isUseful: true
    }
  })
  console.log(`   Total items: ${discoveredContent}`)
  console.log(`   Useful (published): ${usefulContent}`)
  if (discoveredContent === 0) {
    console.log(`   ⚠️  WARNING: No content in DiscoveredContent - frontend will show nothing!`)
  }

  // 5. AgentMemory
  console.log('\n5️⃣  AGENT MEMORY')
  const agentMemories = await prisma.agentMemory.count({
    where: {
      sourceType: 'wikipedia_citation',
      tags: { has: patchHandle }
    }
  })
  console.log(`   Total memories: ${agentMemories}`)
  if (agentMemories > 0 && discoveredContent === 0) {
    console.log(`   ⚠️  Memories exist but DiscoveredContent is empty - saveAsContent may be failing`)
  }

  // 6. Recent Activity
  console.log('\n6️⃣  RECENT ACTIVITY')
  const recentCitations = await prisma.wikipediaCitation.findMany({
    where: { monitoring: { patchId: patch.id } },
    orderBy: { updatedAt: 'desc' },
    take: 5,
    select: {
      citationTitle: true,
      verificationStatus: true,
      scanStatus: true,
      savedContentId: true,
      savedMemoryId: true,
      updatedAt: true
    }
  })
  console.log(`   Last 5 citations processed:`)
  recentCitations.forEach((c, i) => {
    console.log(`   ${i + 1}. ${c.citationTitle || 'Untitled'}`)
    console.log(`      Status: ${c.verificationStatus}/${c.scanStatus}`)
    console.log(`      Content ID: ${c.savedContentId || 'none'}`)
    console.log(`      Memory ID: ${c.savedMemoryId || 'none'}`)
    console.log(`      Updated: ${c.updatedAt.toISOString()}\n`)
  })

  // 7. Summary
  console.log('\n' + '='.repeat(60))
  console.log('\n📋 SUMMARY\n')
  
  const issues: string[] = []
  const working: string[] = []

  if (agents.length > 0) {
    working.push('Agent connected')
  } else {
    issues.push('No agent (will auto-create)')
  }

  if (pages.length > 0) {
    working.push(`${pages.length} Wikipedia pages monitored`)
  } else {
    issues.push('No Wikipedia pages initialized')
  }

  if (totalCitations > 0) {
    working.push(`${totalCitations} citations extracted`)
  } else {
    issues.push('No citations extracted')
  }

  if (discoveredContent > 0) {
    working.push(`${discoveredContent} items in DiscoveredContent (frontend will show)`)
  } else {
    issues.push('No content in DiscoveredContent (frontend will be empty)')
  }

  if (agentMemories > 0) {
    working.push(`${agentMemories} items in AgentMemory`)
  } else {
    issues.push('No items in AgentMemory')
  }

  console.log('✅ Working:')
  working.forEach(item => console.log(`   - ${item}`))
  
  if (issues.length > 0) {
    console.log('\n❌ Issues:')
    issues.forEach(item => console.log(`   - ${item}`))
  }

  // Recommendations
  console.log('\n💡 RECOMMENDATIONS\n')
  if (discoveredContent === 0 && agentMemories > 0) {
    console.log('   ⚠️  CRITICAL: AgentMemory has content but DiscoveredContent is empty.')
    console.log('      This means saveAsContent is failing or not being called.')
    console.log('      Check logs for errors during citation processing.')
    console.log('      The publish_date column was just fixed - restart discovery.')
  }
  
  if (discoveredContent === 0 && scannedCitations > 0) {
    console.log('   ⚠️  Citations are being scanned but not saved to DiscoveredContent.')
    console.log('      Check if saveAsContent callback is working correctly.')
  }

  if (pages.length > 0 && totalCitations === 0) {
    console.log('   ⚠️  Wikipedia pages exist but no citations extracted.')
    console.log('      Check if citation extraction is working.')
  }

  await prisma.$disconnect()
}

const patchHandle = process.argv[2]
if (!patchHandle) {
  console.error('Usage: npx tsx scripts/audit-wikipedia-status.ts [patchHandle]')
  process.exit(1)
}

auditWikipediaStatus(patchHandle).catch(console.error)

