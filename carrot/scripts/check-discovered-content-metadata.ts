#!/usr/bin/env tsx
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkDiscoveredContent() {
  const patchId = 'cmip4pwb40001rt1t7a13p27g'
  
  console.log('🔍 Checking DiscoveredContent Metadata\n')
  
  // Get all DiscoveredContent for this patch
  const allContent = await prisma.discoveredContent.findMany({
    where: {
      patchId
    },
    select: {
      id: true,
      title: true,
      sourceUrl: true,
      metadata: true,
      category: true
    }
  })
  
  console.log(`Total DiscoveredContent: ${allContent.length}\n`)
  
  // Check metadata.source values
  const withMetadata = allContent.filter(c => c.metadata && typeof c.metadata === 'object')
  const sources = withMetadata.map(c => {
    const meta = c.metadata as any
    return meta.source || 'no-source'
  })
  
  const sourceCounts = sources.reduce((acc, source) => {
    acc[source] = (acc[source] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  
  console.log(`📊 Metadata Sources:`)
  Object.entries(sourceCounts).forEach(([source, count]) => {
    console.log(`   ${source}: ${count}`)
  })
  console.log()
  
  // Check categories
  const categoryCounts = allContent.reduce((acc, c) => {
    const cat = c.category || 'no-category'
    acc[cat] = (acc[cat] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  
  console.log(`📊 Categories:`)
  Object.entries(categoryCounts).forEach(([cat, count]) => {
    console.log(`   ${cat}: ${count}`)
  })
  console.log()
  
  // Get saved citations
  const savedCitations = await prisma.wikipediaCitation.findMany({
    where: {
      monitoring: { patchId },
      relevanceDecision: 'saved',
      savedContentId: { not: null }
    },
    select: {
      id: true,
      citationUrl: true,
      savedContentId: true
    }
  })
  
  console.log(`Saved citations with savedContentId: ${savedCitations.length}\n`)
  
  // Match by savedContentId
  const contentIds = savedCitations.map(c => c.savedContentId).filter((id): id is string => id !== null)
  const matchedContent = await prisma.discoveredContent.findMany({
    where: {
      id: { in: contentIds }
    },
    select: {
      id: true,
      title: true,
      sourceUrl: true,
      metadata: true,
      category: true
    }
  })
  
  console.log(`Matched DiscoveredContent by savedContentId: ${matchedContent.length}/${contentIds.length}\n`)
  
  if (matchedContent.length > 0) {
    console.log(`Sample matched content:\n`)
    matchedContent.slice(0, 5).forEach((c, i) => {
      const meta = c.metadata as any
      console.log(`${i + 1}. ${c.title}`)
      console.log(`   URL: ${c.sourceUrl}`)
      console.log(`   Category: ${c.category}`)
      console.log(`   Metadata.source: ${meta?.source || 'N/A'}`)
      console.log()
    })
  }
  
  // Try matching by URL
  const citationUrls = savedCitations.map(c => c.citationUrl)
  const matchedByUrl = allContent.filter(c => 
    c.sourceUrl && citationUrls.includes(c.sourceUrl)
  )
  
  console.log(`Matched by URL: ${matchedByUrl.length}/${savedCitations.length}\n`)
  
  await prisma.$disconnect()
}

checkDiscoveredContent()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })

