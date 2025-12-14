/**
 * Check saved citations and their extraction quality
 */

import 'dotenv/config'
import { prisma } from '../src/lib/prisma'

async function checkSavedCitations(patchHandle: string) {
  const patch = await prisma.patch.findUnique({
    where: { handle: patchHandle },
    select: { id: true }
  })

  if (!patch) {
    console.error(`❌ Patch not found: ${patchHandle}`)
    process.exit(1)
  }

  const saved = await prisma.wikipediaCitation.findMany({
    where: {
      monitoring: { patchId: patch.id },
      relevanceDecision: 'saved'
    },
    take: 20,
    select: {
      citationTitle: true,
      citationUrl: true,
      contentText: true,
      aiPriorityScore: true,
      savedContentId: true
    }
  })

  console.log(`\n✅ Saved Citations (${saved.length}):\n`)

  saved.forEach(c => {
    const contentLength = c.contentText?.length || 0
    const preview = c.contentText?.substring(0, 200).replace(/\n/g, ' ') || 'No content'
    
    console.log(`✅ ${c.citationTitle || 'Untitled'}`)
    console.log(`   URL: ${c.citationUrl.substring(0, 80)}...`)
    console.log(`   Score: ${c.aiPriorityScore || 'N/A'}`)
    console.log(`   Content: ${contentLength} chars`)
    console.log(`   Saved as: ${c.savedContentId || 'Not saved yet'}`)
    console.log(`   Preview: ${preview}...`)
    console.log()
  })

  await prisma.$disconnect()
}

checkSavedCitations(process.argv[2] || 'israel').catch(console.error)

