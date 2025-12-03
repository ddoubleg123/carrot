/**
 * Force regeneration of discovery plan for Israel patch with 10+ seeds
 */

import { prisma } from '../src/lib/prisma'
import { generateGuideSnapshot } from '../src/lib/discovery/planner'

async function main() {
  const patchHandle = 'israel'
  const patch = await prisma.patch.findUnique({
    where: { handle: patchHandle },
    select: { id: true, title: true, guide: true }
  })

  if (!patch) {
    console.error(`Patch with handle "${patchHandle}" not found.`)
    return
  }

  console.log(`\n=== Regenerating Discovery Plan for "${patch.title}" ===\n`)

  // Get aliases from existing guide or use defaults
  const existingGuide = patch.guide as any
  const aliases = existingGuide?.aliases || ['israel', 'palestine', 'apartheid', 'geopolitics', 'zionism']
  const topic = existingGuide?.topic || 'Israel'

  console.log(`Topic: ${topic}`)
  console.log(`Aliases: ${aliases.join(', ')}\n`)

  console.log('Generating new discovery plan with AI...')
  const newPlan = await generateGuideSnapshot(topic, aliases)

  console.log(`\n✅ Generated new plan:`)
  console.log(`  Seed Candidates: ${newPlan.seedCandidates?.length || 0}`)
  console.log(`  Queries: ${Object.keys(newPlan.queries || {}).length} types`)
  console.log(`  Query Angles: ${newPlan.queryAngles?.length || 0}`)
  console.log(`  Controversy Angles: ${newPlan.controversyAngles?.length || 0}\n`)

  if (newPlan.seedCandidates && newPlan.seedCandidates.length < 10) {
    console.warn(`⚠️  WARNING: Only ${newPlan.seedCandidates.length} seed candidates generated (expected 10+)`)
  } else {
    console.log(`✅ Successfully generated ${newPlan.seedCandidates?.length || 0} seed candidates\n`)
  }

  // Show first 10 seed candidates
  if (newPlan.seedCandidates && newPlan.seedCandidates.length > 0) {
    console.log('=== First 10 Seed Candidates ===\n')
    newPlan.seedCandidates.slice(0, 10).forEach((seed: any, index: number) => {
      console.log(`${index + 1}. ${seed.url}`)
      console.log(`   Title: ${seed.titleGuess || seed.alt || 'N/A'}`)
      console.log(`   Category: ${seed.category || 'N/A'}`)
      console.log(`   Angle: ${seed.angle || 'N/A'}`)
      console.log(`   Priority: ${seed.priority || 'N/A'}\n`)
    })
  }

  // Update patch with new guide
  console.log('Updating patch with new guide...')
  await prisma.patch.update({
    where: { id: patch.id },
    data: {
      guide: newPlan as any
    }
  })

  console.log('✅ Patch updated with new discovery plan!\n')
  console.log('Next steps:')
  console.log('1. Start a new discovery run')
  console.log('2. The new plan will be used with 10+ seed candidates')
  console.log('3. Wikipedia-to-Wikipedia crawling will process Level 1 → Level 2 → Level 3\n')

  await prisma.$disconnect()
}

main().catch(console.error)

