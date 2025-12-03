/**
 * Check Israel patch in database
 * Run with: npx tsx scripts/check-israel-patch.ts
 */

import { prisma } from '../src/lib/prisma'

async function checkIsraelPatch() {
  console.log('Checking Israel patch in database...\n')

  try {
    // Find patch by handle
    const patch = await prisma.patch.findUnique({
      where: { handle: 'israel' },
      select: {
        id: true,
        handle: true,
        title: true,
        description: true,
        tags: true,
        entity: true,
        createdAt: true
      }
    })

    if (!patch) {
      console.log('❌ Patch "israel" not found in database')
      return
    }

    console.log('✅ Patch found:')
    console.log(`   ID: ${patch.id}`)
    console.log(`   Handle: ${patch.handle}`)
    console.log(`   Title: ${patch.title}`)
    console.log(`   Description: ${patch.description?.substring(0, 100)}...`)
    console.log(`   Tags: ${JSON.stringify(patch.tags)}`)
    console.log(`   Entity: ${patch.entity}`)
    console.log(`   Created: ${patch.createdAt.toISOString()}\n`)

    // Check Wikipedia monitoring
    const wikipediaPages = await prisma.wikipediaMonitoring.findMany({
      where: { patchId: patch.id },
      select: {
        id: true,
        wikipediaTitle: true,
        wikipediaUrl: true,
        status: true,
        contentScanned: true,
        citationsExtracted: true,
        citationCount: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    })

    console.log(`📚 Wikipedia Monitoring: ${wikipediaPages.length} pages found\n`)

    if (wikipediaPages.length > 0) {
      console.log('Wikipedia pages:')
      wikipediaPages.forEach((page, i) => {
        console.log(`  ${i + 1}. "${page.wikipediaTitle}"`)
        console.log(`     URL: ${page.wikipediaUrl}`)
        console.log(`     Status: ${page.status}`)
        console.log(`     Content Scanned: ${page.contentScanned}`)
        console.log(`     Citations Extracted: ${page.citationsExtracted}`)
        console.log(`     Citation Count: ${page.citationCount}`)
        console.log(`     Created: ${page.createdAt.toISOString()}\n`)
      })
    } else {
      console.log('⚠️  No Wikipedia pages found - monitoring may not have been initialized yet\n')
    }

    // Check citations
    const totalCitations = await prisma.wikipediaCitation.count({
      where: { monitoring: { patchId: patch.id } }
    })

    console.log(`📄 Total Citations: ${totalCitations}\n`)

    // Check discovered content
    const discoveredContent = await prisma.discoveredContent.count({
      where: { patchId: patch.id, category: 'wikipedia_citation' }
    })

    console.log(`📰 Discovered Content (Wikipedia): ${discoveredContent}\n`)

    // Check agent memory
    const agentMemory = await prisma.agentMemory.count({
      where: {
        sourceType: 'wikipedia_citation',
        tags: { has: patch.handle }
      }
    })

    console.log(`🧠 Agent Memory (Wikipedia): ${agentMemory}\n`)

  } catch (error: any) {
    console.error('❌ Error:', error.message)
    console.error(error)
  } finally {
    await prisma.$disconnect()
  }
}

checkIsraelPatch().catch(console.error)

