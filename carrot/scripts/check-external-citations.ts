#!/usr/bin/env tsx
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkExternalCitations() {
  const patchId = 'cmip4pwb40001rt1t7a13p27g'
  
  const external = await prisma.wikipediaCitation.findMany({
    where: {
      monitoring: { patchId },
      verificationStatus: 'pending',
      scanStatus: 'not_scanned',
      relevanceDecision: null,
      NOT: [
        { citationUrl: { startsWith: './' } },
        { citationUrl: { startsWith: '/wiki/' } },
        { citationUrl: { contains: 'wikipedia.org' } },
        { citationUrl: { contains: 'wikimedia.org' } },
        { citationUrl: { contains: 'wikidata.org' } }
      ]
    },
    select: {
      citationUrl: true,
      aiPriorityScore: true
    },
    take: 20
  })
  
  console.log(`External citations found: ${external.length}\n`)
  external.forEach((c, i) => {
    console.log(`${i + 1}. ${c.citationUrl} (score: ${c.aiPriorityScore || 'N/A'})`)
  })
  
  await prisma.$disconnect()
}

checkExternalCitations()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })

