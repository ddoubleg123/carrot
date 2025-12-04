/**
 * Reset discovery to start from the beginning
 * Clears frontier, seen URLs, and optionally re-extracts Wikipedia pages
 */

import { prisma } from '../src/lib/prisma'
import { clearFrontier } from '../src/lib/redis/discovery'

async function main() {
  const args = process.argv.slice(2)
  const patchHandle = args.find(a => a.startsWith('--patch='))?.split('=')[1]
  const clearSeen = args.includes('--clear-seen')
  const reExtractWiki = args.includes('--re-extract-wiki')

  if (!patchHandle) {
    console.error('Usage: npx tsx scripts/reset-discovery.ts --patch=<handle> [--clear-seen] [--re-extract-wiki]')
    console.error('\nOptions:')
    console.error('  --patch=<handle>     Patch handle (required)')
    console.error('  --clear-seen        Clear seen URLs in Redis (optional)')
    console.error('  --re-extract-wiki    Re-extract Wikipedia citations with new logic (optional)')
    process.exit(1)
  }

  console.log(`\n=== Resetting Discovery ===\n`)
  console.log(`Patch: ${patchHandle}`)
  console.log(`Clear seen URLs: ${clearSeen}`)
  console.log(`Re-extract Wikipedia: ${reExtractWiki}\n`)

  // Get patch
  const patch = await prisma.patch.findUnique({
    where: { handle: patchHandle },
    select: { id: true, title: true }
  })

  if (!patch) {
    console.error(`❌ Patch "${patchHandle}" not found`)
    process.exit(1)
  }

  console.log(`✅ Found patch: ${patch.title} (${patch.id})\n`)

  // 1. Clear frontier
  console.log(`1. Clearing frontier queue...`)
  try {
    if (process.env.REDIS_URL) {
      await clearFrontier(patch.id)
      console.log(`   ✅ Frontier cleared`)
    } else {
      console.log(`   ⚠️  REDIS_URL not set, skipping frontier clear (expected in local dev)`)
    }
  } catch (error) {
    console.error(`   ❌ Failed to clear frontier:`, error)
  }

  // 2. Clear seen URLs (optional)
  if (clearSeen) {
    console.log(`\n2. Clearing seen URLs...`)
    try {
      const { getRedisClient } = await import('../src/lib/redis/discovery')
      const client = await getRedisClient()
      const { resolvePatch } = await import('../src/lib/redis/keys')
      const { id } = resolvePatch(patch.id)
      const seenKey = `seen:patch:${id}`
      await client.del(seenKey)
      console.log(`   ✅ Seen URLs cleared (${seenKey})`)
    } catch (error) {
      console.error(`   ❌ Failed to clear seen URLs:`, error)
    }
  }

  // 3. Re-extract Wikipedia citations (optional)
  if (reExtractWiki) {
    console.log(`\n3. Re-extracting Wikipedia citations...`)
    try {
      // Get all Wikipedia pages being monitored
      const wikiPages = await prisma.wikipediaMonitoring.findMany({
        where: { patchId: patch.id },
        select: { id: true, wikipediaTitle: true }
      })

      console.log(`   Found ${wikiPages.length} Wikipedia pages to re-extract`)

      // Mark all citations as not_scanned so they get re-extracted
      const updateResult = await prisma.wikipediaCitation.updateMany({
        where: {
          monitoring: {
            patchId: patch.id
          }
        },
        data: {
          scanStatus: 'not_scanned',
          verificationStatus: 'pending',
          relevanceDecision: null,
          contentText: null,
          aiPriorityScore: null,
          lastScannedAt: null,
          errorMessage: null
        }
      })

      console.log(`   ✅ Reset ${updateResult.count} citations to not_scanned`)
      console.log(`   Note: Citations will be re-extracted on next discovery run`)
    } catch (error) {
      console.error(`   ❌ Failed to reset citations:`, error)
    }
  }

  // 4. Update active discovery run status (if any)
  console.log(`\n4. Checking for active discovery runs...`)
  try {
    const activeRuns = await prisma.discoveryRun.findMany({
      where: {
        patchId: patch.id,
        status: { in: ['queued', 'live', 'running'] }
      },
      select: { id: true, status: true }
    })

    if (activeRuns.length > 0) {
      console.log(`   Found ${activeRuns.length} active run(s)`)
      for (const run of activeRuns) {
        await prisma.discoveryRun.update({
          where: { id: run.id },
          data: { status: 'completed' }
        })
        console.log(`   ✅ Marked run ${run.id} as completed`)
      }
    } else {
      console.log(`   ✅ No active runs found`)
    }
  } catch (error) {
    console.error(`   ❌ Failed to update runs:`, error)
  }

  console.log(`\n=== Reset Complete ===\n`)
  console.log(`Next steps:`)
  console.log(`1. Start a new discovery run from the UI or API`)
  console.log(`2. The new extraction logic will be used for all Wikipedia pages`)
  console.log(`3. All ${reExtractWiki ? 'citations will be' : 'new citations will be'} extracted with the updated logic`)

  process.exit(0)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})

