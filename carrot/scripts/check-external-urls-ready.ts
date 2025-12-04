/**
 * Check external URLs ready to process
 */

import { prisma } from '../src/lib/prisma'

async function main() {
  const patchHandle = process.argv.find(a => a.startsWith('--patch='))?.split('=')[1] || 'israel'

  const patch = await prisma.patch.findUnique({
    where: { handle: patchHandle },
    select: { id: true }
  })

  if (!patch) {
    console.error(`Patch not found`)
    process.exit(1)
  }

  const citations = await prisma.wikipediaCitation.findMany({
    where: {
      monitoring: { patchId: patch.id },
      verificationStatus: { in: ['pending', 'verified'] },
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
    take: 20,
    select: {
      citationUrl: true,
      citationTitle: true,
      aiPriorityScore: true
    },
    orderBy: { aiPriorityScore: 'desc' }
  })

  console.log(`\nExternal URLs ready to process: ${citations.length}\n`)
  citations.forEach((c, i) => {
    console.log(`${i + 1}. ${c.citationUrl.substring(0, 100)}`)
    if (c.citationTitle) console.log(`   Title: ${c.citationTitle.substring(0, 80)}`)
    if (c.aiPriorityScore) console.log(`   Priority: ${c.aiPriorityScore}`)
    console.log()
  })

  process.exit(0)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})

