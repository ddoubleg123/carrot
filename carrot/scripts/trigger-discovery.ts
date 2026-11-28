/**
 * Quick script to trigger discovery for a patch
 * Usage: npx tsx scripts/trigger-discovery.ts [handle]
 */

import 'dotenv/config'
import { prisma } from '../src/lib/prisma'
import { seedFrontierFromPlan, generateGuideSnapshot } from '../src/lib/discovery/planner'
import { runOpenEvidenceEngine } from '../src/lib/discovery/engine'
import { clearFrontier, storeDiscoveryPlan } from '../src/lib/redis/discovery'
import { Prisma } from '@prisma/client'

const PATCH_HANDLE = process.argv[2] || 'israel'

async function main() {
  console.log(`\n🚀 Triggering discovery for patch: ${PATCH_HANDLE}\n`)

  const patch = await prisma.patch.findUnique({
    where: { handle: PATCH_HANDLE },
    select: {
      id: true,
      title: true,
      description: true,
      tags: true,
      entity: true,
      guide: true
    }
  })

  if (!patch) {
    console.error(`❌ Patch with handle "${PATCH_HANDLE}" not found`)
    process.exit(1)
  }

  console.log(`✅ Found patch: ${patch.title}`)

  // Create discovery run
  const run = await prisma.discoveryRun.create({
    data: {
      patchId: patch.id,
      status: 'queued'
    }
  })

  console.log(`✅ Created discovery run: ${run.id}`)

  // Generate or use existing guide
  let guide = patch.guide as any | null
  if (!guide) {
    console.log('📋 Generating discovery guide...')
    const entity = (patch.entity ?? {}) as { name?: string; aliases?: string[] }
    const topic = entity?.name && entity.name.trim().length ? entity.name.trim() : patch.title
    const aliases = Array.isArray(entity?.aliases) && entity.aliases.length
      ? entity.aliases.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
      : patch.tags.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)

    guide = await generateGuideSnapshot(topic, aliases)
    await prisma.patch.update({
      where: { id: patch.id },
      data: { guide: guide as unknown as Prisma.JsonObject }
    })
    console.log('✅ Guide generated')
  } else {
    console.log('✅ Using existing guide')
  }

  // Clear frontier
  try {
    await clearFrontier(patch.id)
    console.log('✅ Frontier cleared')
  } catch (error) {
    console.warn('⚠️  Failed to clear frontier:', error)
  }

  // Store plan and seed frontier
  await storeDiscoveryPlan(run.id, guide)
  console.log('✅ Discovery plan stored')
  
  await seedFrontierFromPlan(patch.id, guide)
  console.log('✅ Frontier seeded')

  // Update run status
  await prisma.discoveryRun.update({
    where: { id: run.id },
    data: {
      status: 'live',
      startedAt: new Date()
    }
  })

  console.log('✅ Discovery run marked as live')

  // Start engine (non-blocking)
  runOpenEvidenceEngine({
    patchId: patch.id,
    patchHandle: PATCH_HANDLE,
    patchName: patch.title,
    runId: run.id
  }).catch(async (error) => {
    console.error('❌ Discovery engine failed:', error)
    await prisma.discoveryRun.update({
      where: { id: run.id },
      data: {
        status: 'error',
        metrics: {
          error: error instanceof Error ? error.message : String(error)
        }
      }
    }).catch(() => undefined)
  })

  console.log('\n✅ Discovery engine started (running in background)')
  console.log(`\n📊 View citations audit page at:`)
  console.log(`   http://localhost:3005/test/citations-audit/${PATCH_HANDLE}`)
  console.log(`   (or your production URL + /test/citations-audit/${PATCH_HANDLE})\n`)
  
  console.log(`\n📝 Discovery Run ID: ${run.id}`)
  console.log(`   You can check the status in the database or on the patch page.\n`)
}

main().catch((error) => {
  console.error('❌ Error:', error)
  process.exit(1)
})

