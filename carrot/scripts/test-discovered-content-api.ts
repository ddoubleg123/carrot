/**
 * Test the discovered-content API endpoint
 * Run with: npx tsx scripts/test-discovered-content-api.ts chicago-bulls
 */

import { prisma } from '../src/lib/prisma'

async function testDiscoveredContentAPI(patchHandle: string) {
  const patch = await prisma.patch.findUnique({
    where: { handle: patchHandle },
    select: { id: true, handle: true, title: true }
  })

  if (!patch) {
    console.error(`Patch "${patchHandle}" not found`)
    process.exit(1)
  }

  console.log(`\n🔍 Testing DiscoveredContent API for: ${patch.title}\n`)

  // Query exactly as the API does
  const allContent = await prisma.discoveredContent.findMany({
    where: {
      patchId: patch.id
    },
    orderBy: [
      { createdAt: 'desc' },
      { id: 'desc' }
    ],
    take: 50,
    select: {
      id: true,
      title: true,
      sourceUrl: true,
      canonicalUrl: true,
      category: true,
      summary: true,
      relevanceScore: true,
      qualityScore: true,
      importanceScore: true,
      createdAt: true,
      whyItMatters: true,
      facts: true,
      quotes: true,
      provenance: true,
      hero: true,
      metadata: true,
      textContent: true,
      isUseful: true
    }
  })

  console.log(`Total items from database: ${allContent.length}\n`)

  // Filter as the API does
  const filteredContent = allContent.filter(item => {
    if (!item.title || item.title.trim().length === 0) {
      return false
    }
    return true
  })

  console.log(`After filtering (title check): ${filteredContent.length}\n`)

  // Break down by category
  const byCategory: Record<string, number> = {}
  filteredContent.forEach(item => {
    const cat = item.category || 'uncategorized'
    byCategory[cat] = (byCategory[cat] || 0) + 1
  })

  console.log('Items by category:')
  Object.entries(byCategory).forEach(([cat, count]) => {
    console.log(`  ${cat}: ${count}`)
  })

  // Show Wikipedia citations
  const wikipediaCitations = filteredContent.filter(item => item.category === 'wikipedia_citation')
  console.log(`\nWikipedia citations: ${wikipediaCitations.length}`)
  console.log(`\nRecent Wikipedia citations (last 10):`)
  wikipediaCitations.slice(0, 10).forEach((item, i) => {
    console.log(`\n${i + 1}. ${item.title}`)
    console.log(`   URL: ${item.sourceUrl || item.canonicalUrl}`)
    console.log(`   Type: ${item.type || 'N/A'}`)
    console.log(`   Useful: ${item.isUseful}`)
    console.log(`   Created: ${item.createdAt.toISOString()}`)
    console.log(`   Has textContent: ${item.textContent ? 'Yes (' + item.textContent.length + ' chars)' : 'No'}`)
    console.log(`   Has summary: ${item.summary ? 'Yes (' + item.summary.length + ' chars)' : 'No'}`)
  })

  // Check if items have required fields for frontend
  const withAllFields = filteredContent.filter(item => {
    return item.title && 
           (item.sourceUrl || item.canonicalUrl) &&
           item.type
  })

  console.log(`\nItems with all required fields: ${withAllFields.length}`)
  console.log(`Items missing required fields: ${filteredContent.length - withAllFields.length}`)

  await prisma.$disconnect()
}

const patchHandle = process.argv[2]
if (!patchHandle) {
  console.error('Usage: npx tsx scripts/test-discovered-content-api.ts [patchHandle]')
  process.exit(1)
}

testDiscoveredContentAPI(patchHandle).catch(console.error)

