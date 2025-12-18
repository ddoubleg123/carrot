#!/usr/bin/env tsx
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkSavedCitations() {
  const patchId = 'cmip4pwb40001rt1t7a13p27g'
  
  console.log('🔍 Checking Saved Citations and DiscoveredContent\n')
  
  // Get saved citations
  const saved = await prisma.wikipediaCitation.findMany({
    where: {
      monitoring: { patchId },
      relevanceDecision: 'saved'
    },
    select: {
      id: true,
      citationUrl: true,
      savedContentId: true,
      savedMemoryId: true,
      aiPriorityScore: true,
      contentText: true,
      updatedAt: true
    }
  })
  
  console.log(`Total saved citations: ${saved.length}\n`)
  
  const withSavedContentId = saved.filter(c => c.savedContentId !== null)
  const withoutSavedContentId = saved.filter(c => c.savedContentId === null)
  
  console.log(`📊 Breakdown:`)
  console.log(`   With savedContentId: ${withSavedContentId.length}`)
  console.log(`   Without savedContentId: ${withoutSavedContentId.length} ⚠️\n`)
  
  // Check if DiscoveredContent exists for those with savedContentId
  if (withSavedContentId.length > 0) {
    const contentIds = withSavedContentId.map(c => c.savedContentId).filter((id): id is string => id !== null)
    const discoveredContent = await prisma.discoveredContent.findMany({
      where: {
        id: { in: contentIds }
      },
      select: {
        id: true,
        title: true,
        sourceUrl: true
      }
    })
    
    console.log(`DiscoveredContent found: ${discoveredContent.length}/${contentIds.length}`)
    
    if (discoveredContent.length < contentIds.length) {
      console.log(`⚠️  Some savedContentId references are broken\n`)
    }
  }
  
  // Check citations without savedContentId
  if (withoutSavedContentId.length > 0) {
    console.log(`❌ Citations without savedContentId (${withoutSavedContentId.length}):\n`)
    withoutSavedContentId.slice(0, 10).forEach((c, i) => {
      console.log(`${i + 1}. ${c.citationUrl.substring(0, 80)}...`)
      console.log(`   Score: ${c.aiPriorityScore || 'N/A'}, Content: ${c.contentText?.length || 0} chars`)
      console.log(`   Updated: ${c.updatedAt.toISOString()}\n`)
    })
  }
  
  // Check if DiscoveredContent exists by sourceUrl matching
  const discoveredByUrl = await prisma.discoveredContent.findMany({
    where: {
      patchId,
      metadata: {
        path: ['source'],
        equals: 'wikipedia-citation'
      }
    },
    select: {
      id: true,
      title: true,
      sourceUrl: true
    }
  })
  
  console.log(`\nDiscoveredContent with source='wikipedia-citation': ${discoveredByUrl.length}`)
  
  // Try to match saved citations with DiscoveredContent by URL
  const matched = saved.filter(c => {
    return discoveredByUrl.some(dc => dc.sourceUrl === c.citationUrl)
  })
  
  console.log(`Matched by URL: ${matched.length}/${saved.length}\n`)
  
  if (matched.length < saved.length) {
    console.log(`⚠️  ${saved.length - matched.length} saved citations don't have matching DiscoveredContent`)
    console.log(`   This means the save pipeline isn't creating DiscoveredContent correctly\n`)
  }
  
  await prisma.$disconnect()
}

checkSavedCitations()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })

