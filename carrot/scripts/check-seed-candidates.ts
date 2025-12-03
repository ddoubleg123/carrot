/**
 * Check seed candidates in the discovery plan
 */

import { prisma } from '../src/lib/prisma'

async function main() {
  // Get Israel patch
  const patch = await prisma.patch.findUnique({
    where: { handle: 'israel' },
    select: { 
      id: true, 
      title: true,
      guide: true
    }
  })

  if (!patch) {
    console.error('Israel patch not found')
    process.exit(1)
  }

  console.log(`\n=== Seed Candidates for "${patch.title}" ===\n`)

  const guide = patch.guide as any
  if (!guide) {
    console.log('No guide found')
    process.exit(1)
  }

  console.log(`Topic: ${guide.topic || 'N/A'}`)
  console.log(`Aliases: ${Array.isArray(guide.aliases) ? guide.aliases.join(', ') : 'N/A'}`)
  console.log(`Generated At: ${guide.generatedAt || 'N/A'}\n`)

  // Check seed candidates
  const seedCandidates = Array.isArray(guide.seedCandidates) ? guide.seedCandidates : []
  console.log(`Total Seed Candidates: ${seedCandidates.length}\n`)

  if (seedCandidates.length > 0) {
    console.log('=== Seed Candidates ===\n')
    seedCandidates.forEach((seed: any, index: number) => {
      console.log(`${index + 1}. ${seed.url || 'N/A'}`)
      console.log(`   Title: ${seed.title || 'N/A'}`)
      console.log(`   Source: ${seed.source || 'N/A'}`)
      console.log(`   Priority: ${seed.priority || 'N/A'}`)
      if (seed.meta) {
        console.log(`   Meta: ${JSON.stringify(seed.meta)}`)
      }
      console.log('')
    })
  } else {
    console.log('No seed candidates found in guide\n')
  }

  // Check queries
  const queries = Array.isArray(guide.queries) ? guide.queries : []
  console.log(`Total Queries: ${queries.length}\n`)
  
  if (queries.length > 0) {
    console.log('=== First 5 Queries ===\n')
    queries.slice(0, 5).forEach((query: any, index: number) => {
      console.log(`${index + 1}. ${query.query || query}`)
    })
  }

  // Check what should be expected
  console.log('\n=== Expected Seed Count ===')
  console.log('A typical discovery plan should have:')
  console.log('- 10-20 seed candidates (Wikipedia pages, official sources, news)')
  console.log('- 5-10 search queries')
  console.log('- Multiple angles/coverage targets')
  
  if (seedCandidates.length < 10) {
    console.log('\n⚠️  WARNING: Only 1 seed candidate found. This is too few!')
    console.log('   The plan should be regenerated with more seeds.')
  }

  await prisma.$disconnect()
}

main().catch(console.error)

