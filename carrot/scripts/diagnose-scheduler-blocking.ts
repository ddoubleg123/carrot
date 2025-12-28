/**
 * Diagnose which scheduler guard is blocking items
 */

import 'dotenv/config'
import { prisma } from '../src/lib/prisma'
import { SchedulerGuards } from '../src/lib/discovery/scheduler'

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

  console.log(`\n🔍 Diagnosing Scheduler Guard Blocking`)
  console.log(`Patch: ${patch.title} (${patch.id})\n`)

  // Note: This creates a NEW scheduler instance, so it won't have the state from the running engine
  // But we can see the default configuration
  const scheduler = new SchedulerGuards({
    patchId: patch.id,
    redisPatchId: patch.id
  })

  console.log(`📊 Scheduler Configuration:`)
  console.log(`   Host Attempt Cap: ${scheduler.getHostAttemptCap()}`)
  console.log(`   Run Attempt Cap: ${scheduler.getRunAttemptCap()}`)
  
  // Get Wiki guard state (will be empty for new instance, but shows structure)
  const wikiState = scheduler.getWikiGuardState()
  console.log(`\n📊 Wiki Guard State:`)
  console.log(`   Active: ${wikiState.active}`)
  console.log(`   Share: ${wikiState.share.toFixed(2)}`)
  console.log(`   Window: ${wikiState.window}`)
  if (wikiState.cooldownExpiresAt) {
    const remaining = Math.max(0, wikiState.cooldownExpiresAt - Date.now())
    console.log(`   Cooldown expires in: ${Math.floor(remaining / 1000)}s`)
  } else {
    console.log(`   Not active`)
  }

  console.log(`\n📊 Host Diversity:`)
  const diversity = scheduler.getHostDiversityCount()
  console.log(`   Unique hosts seen: ${diversity}`)
  console.log(`   Required: 3+`)
  if (diversity < 3) {
    console.log(`   ⚠️  LOW DIVERSITY - Wikipedia items will be BLOCKED`)
  }

  console.log(`\n📊 Guard Checks (in order):`)
  console.log(`   1. Wiki Guard: Blocks if active AND host is wikipedia.org`)
  console.log(`   2. Host Cap: Blocks if host attempts >= ${scheduler.getHostAttemptCap()}`)
  console.log(`   3. Wiki Low Diversity: Blocks if wikipedia.org AND diversity < 3`)
  console.log(`   4. Host Success Bias: Blocks if host success rate < 45%`)
  console.log(`   5. Contested Bias: Blocks if needed AND candidate not contested`)
  console.log(`   6. QPS Throttle: Blocks if host accessed < 2s ago (0.5 QPS)`)

  console.log(`\n💡 Key Insights:`)
  console.log(`   - Wiki Low Diversity requires 3+ unique hosts before ANY Wikipedia items can process`)
  console.log(`   - If frontier is mostly Wikipedia, this creates a deadlock`)
  console.log(`   - Contested Bias requires 50%+ contested attempts after 5 items processed`)
  console.log(`   - If frontier has no contested items, all items get blocked`)

  console.log(`\n⚠️  To see ACTUAL state, check the running engine's logs for:`)
  console.log(`   - "frontier_pull_all_requeued" events with reason`)
  console.log(`   - Scheduler state metrics in structured logs`)
  console.log(`   - Host attempt counts and diversity metrics`)

  await prisma.$disconnect()
}

main().catch(console.error)

