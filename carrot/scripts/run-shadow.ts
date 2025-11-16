import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { runOpenEvidenceEngine } from '@/lib/discovery/engine'
import { clearFrontier, storeDiscoveryPlan } from '@/lib/redis/discovery'
import { seedFrontierFromPlan } from '@/lib/discovery/planner'

const prisma = new PrismaClient()

async function main() {
  const handle = process.argv[2] ?? 'chicago-bulls'
  const patch = await prisma.patch.findUnique({
    where: { handle },
    select: { id: true, title: true, guide: true }
  })

  if (!patch) {
    throw new Error(`Patch ${handle} not found`)
  }
  if (!patch.guide) {
    throw new Error(`Patch ${handle} is missing a stored discovery guide`)
  }

  const run = await (prisma as any).discoveryRun.create({
    data: { patchId: patch.id, status: 'queued' },
    select: { id: true }
  })

  await clearFrontier(patch.id).catch(() => undefined)
  await storeDiscoveryPlan(run.id, patch.guide as any)
  await seedFrontierFromPlan(patch.id, patch.guide as any)

  await (prisma as any).discoveryRun.update({
    where: { id: run.id },
    data: { status: 'live', startedAt: new Date() }
  }).catch(() => undefined)

  console.log('[ShadowRun] starting discovery run', { patchId: patch.id, runId: run.id })

  runOpenEvidenceEngine({
    patchId: patch.id,
    patchHandle: handle,
    patchName: patch.title ?? handle,
    runId: run.id
  }).catch((error) => {
    console.error('[ShadowRun] engine failed', error)
  })

  // keep process alive for observation
  setInterval(() => {}, 60_000)
}

main()
  .catch((error) => {
    console.error('[ShadowRun] bootstrap failed', error)
  })
  .finally(() => {
    prisma.$disconnect().catch(() => undefined)
  })
