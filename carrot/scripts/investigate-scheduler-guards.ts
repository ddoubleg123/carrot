/**
 * Investigate why scheduler guards are blocking all frontier items
 */

import 'dotenv/config'
import { prisma } from '../src/lib/prisma'
import { SchedulerGuards } from '../src/lib/discovery/scheduler'
import { popFromFrontier } from '../src/lib/redis/discovery'

const PATCH_HANDLE = 'israel'

async function main() {
  const patch = await prisma.patch.findUnique({
    where: { handle: PATCH_HANDLE },
    select: { id: true, title: true }
  })

  if (!patch) {
    console.error(`Patch "${PATCH_HANDLE}" not found`)
    process.exit(1)
  }

  console.log(`\n🔍 Investigating Scheduler Guards for: ${patch.title}\n`)

  // Create a scheduler instance to check state
  const scheduler = new SchedulerGuards({
    patchId: patch.id,
    redisPatchId: patch.id
  })

  // Get Wiki guard state
  const wikiGuardState = scheduler.getWikiGuardState()
  console.log(`📊 Wiki Guard State:`)
  console.log(`   Active: ${wikiGuardState.active}`)
  console.log(`   Share: ${wikiGuardState.share}`)
  console.log(`   Window: ${wikiGuardState.window}`)
  if (wikiGuardState.cooldownExpiresAt) {
    const now = Date.now()
    const remaining = Math.max(0, wikiGuardState.cooldownExpiresAt - now)
    console.log(`   Cooldown expires in: ${Math.floor(remaining / 1000)}s`)
  }

  // Get host attempt counts
  console.log(`\n📊 Host Attempt Caps:`)
  console.log(`   Host Cap: ${scheduler.getHostAttemptCap()}`)
  console.log(`   Run Cap: ${scheduler.getRunAttemptCap()}`)
  console.log(`   Total Attempts: ${scheduler.getTotalAttemptCount()}`)

  // Try to pull a few candidates and see why they're being rejected
  console.log(`\n🔍 Testing Candidate Evaluation:`)
  console.log(`   Attempting to pull and evaluate candidates...\n`)

  const testCandidates: any[] = []
  for (let i = 0; i < 5; i++) {
    try {
      const candidate = await popFromFrontier(patch.id)
      if (!candidate) {
        console.log(`   No more candidates available after ${i} attempts`)
        break
      }

      // Resolve host
      let host: string | null = null
      try {
        if (typeof candidate.cursor === 'string') {
          const url = new URL(candidate.cursor)
          host = url.hostname.toLowerCase()
        }
      } catch {
        // Invalid URL, skip
      }

      const isContested = candidate.meta?.isControversy === true || 
                         (typeof candidate.meta?.stance === 'string' && candidate.meta.stance.toLowerCase() === 'contested')

      const evaluation = scheduler.evaluateCandidate({
        candidate,
        host,
        isContested
      })

      testCandidates.push({
        url: typeof candidate.cursor === 'string' ? candidate.cursor.substring(0, 80) : 'N/A',
        host,
        isContested,
        provider: candidate.provider,
        evaluation
      })

      // Re-add to frontier for next test
      await import('@/lib/redis/discovery').then(m => m.addToFrontier(patch.id, candidate))

      console.log(`   Candidate ${i + 1}:`)
      console.log(`      URL: ${typeof candidate.cursor === 'string' ? candidate.cursor.substring(0, 80) : 'N/A'}`)
      console.log(`      Host: ${host || 'N/A'}`)
      console.log(`      Provider: ${candidate.provider}`)
      console.log(`      Is Contested: ${isContested}`)
      console.log(`      Evaluation: ${evaluation.action}`)
      console.log(`      Reason: ${evaluation.reason || 'N/A'}`)
      console.log()

    } catch (error: any) {
      console.error(`   Error testing candidate ${i + 1}:`, error.message)
    }
  }

  // Summary
  console.log(`\n📊 Summary:`)
  const accepted = testCandidates.filter(c => c.evaluation.action === 'accept').length
  const requeued = testCandidates.filter(c => c.evaluation.action === 'requeue').length
  console.log(`   Total tested: ${testCandidates.length}`)
  console.log(`   Accepted: ${accepted}`)
  console.log(`   Requeued: ${requeued}`)

  if (requeued > 0) {
    console.log(`\n⚠️  Requeue Reasons:`)
    const reasons = testCandidates
      .filter(c => c.evaluation.action === 'requeue')
      .map(c => c.evaluation.reason)
      .reduce((acc, reason) => {
        acc[reason] = (acc[reason] || 0) + 1
        return acc
      }, {} as Record<string, number>)

    Object.entries(reasons).forEach(([reason, count]) => {
      console.log(`   ${reason}: ${count}`)
    })
  }

  // Check host diversity
  const hostDiversity = scheduler.getHostDiversityCount()
  console.log(`\n📊 Host Diversity:`)
  console.log(`   Unique hosts: ${hostDiversity}`)
  if (hostDiversity < 3) {
    console.log(`   ⚠️  Low host diversity (< 3) - Wikipedia items will be requeued`)
  }

  await prisma.$disconnect()
}

main().catch(console.error)

