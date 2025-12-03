/**
 * Check if a patch has a discovery plan and when it was created
 */

import { prisma } from '../src/lib/prisma'
import { loadDiscoveryPlan } from '../src/lib/redis/discovery'

async function main() {
  // Get Israel patch
  const patch = await prisma.patch.findUnique({
    where: { handle: 'israel' },
    select: { 
      id: true, 
      title: true,
      guide: true,
      createdAt: true,
      updatedAt: true
    }
  })

  if (!patch) {
    console.error('Israel patch not found')
    process.exit(1)
  }

  console.log(`\n=== Discovery Plan Status for "${patch.title}" ===\n`)
  console.log(`Patch ID: ${patch.id}`)
  console.log(`Created: ${patch.createdAt}`)
  console.log(`Last Updated: ${patch.updatedAt}\n`)

  // Check if guide exists in patch record
  const hasGuide = patch.guide !== null && typeof patch.guide === 'object'
  console.log(`Guide in Patch Record: ${hasGuide ? 'YES' : 'NO'}`)
  
  if (hasGuide) {
    const guide = patch.guide as any
    console.log(`Guide Type: ${typeof guide}`)
    if (guide && typeof guide === 'object') {
      console.log(`Guide Keys: ${Object.keys(guide).join(', ')}`)
      if (guide.seedCandidates) {
        console.log(`Seed Candidates: ${Array.isArray(guide.seedCandidates) ? guide.seedCandidates.length : 'N/A'}`)
      }
      if (guide.queries) {
        console.log(`Queries: ${Array.isArray(guide.queries) ? guide.queries.length : 'N/A'}`)
      }
    }
  }

  // Check latest discovery run
  const latestRun = await (prisma as any).discoveryRun.findFirst({
    where: { patchId: patch.id },
    orderBy: { id: 'desc' }, // Use id for ordering instead of createdAt
    select: {
      id: true,
      status: true,
      startedAt: true
    }
  })

  if (latestRun) {
    console.log(`\nLatest Discovery Run:`)
    console.log(`  Run ID: ${latestRun.id}`)
    console.log(`  Status: ${latestRun.status}`)
    console.log(`  Created: ${latestRun.createdAt}`)
    console.log(`  Started: ${latestRun.startedAt || 'Not started'}`)

    // Try to load plan from Redis
    try {
      const redisPlan = await loadDiscoveryPlan(latestRun.id)
      if (redisPlan) {
        console.log(`\nPlan in Redis (for this run): YES`)
        const plan = redisPlan as any
        if (plan.seedCandidates) {
          console.log(`  Seed Candidates: ${Array.isArray(plan.seedCandidates) ? plan.seedCandidates.length : 'N/A'}`)
        }
        if (plan.queries) {
          console.log(`  Queries: ${Array.isArray(plan.queries) ? plan.queries.length : 'N/A'}`)
        }
      } else {
        console.log(`\nPlan in Redis (for this run): NO (expired or not stored)`)
      }
    } catch (error) {
      console.log(`\nPlan in Redis (for this run): ERROR - ${error instanceof Error ? error.message : 'Unknown'}`)
    }
  } else {
    console.log(`\nNo discovery runs found`)
  }

  // Check all runs
  const allRuns = await (prisma as any).discoveryRun.findMany({
    where: { patchId: patch.id },
    orderBy: { id: 'desc' }, // Use id for ordering
    select: {
      id: true,
      status: true,
      startedAt: true
    },
    take: 5
  })

  console.log(`\n=== Recent Discovery Runs (last 5) ===`)
  allRuns.forEach((run: any, index: number) => {
    console.log(`${index + 1}. Run ${run.id.substring(0, 8)}... - Status: ${run.status} - Started: ${run.startedAt || 'Not started'}`)
  })

  await prisma.$disconnect()
}

main().catch(console.error)

