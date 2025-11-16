import { clearPlan, clearSaveCounters, clearPlan as clearDiscoveryPlan, frontierSize } from '@/lib/redis/discovery'
import prisma from '@/lib/prisma'

async function main() {
  const handle = process.argv[2]
  if (!handle) {
    console.error('Usage: tsx scripts/clear-discovery-state.ts <patch-handle>')
    process.exit(1)
  }
  const patch = await prisma.patch.findUnique({ where: { handle }, select: { id: true } })
  if (!patch?.id) {
    console.error(`Patch not found for handle: ${handle}`)
    process.exit(1)
  }
  const patchId = patch.id
  // Clear the discovery plan cache and save counters
  await clearDiscoveryPlan(patchId).catch(() => {})
  await clearSaveCounters(patchId).catch(() => {})
  const size = await frontierSize(patchId).catch(() => 0)
  console.log(JSON.stringify({ ok: true, patchId, frontierSize: size }, null, 2))
  await prisma.$disconnect().catch(() => {})
}

main().catch(async (err) => {
  console.error(err?.message || err)
  try { await prisma.$disconnect() } catch {}
  process.exit(1)
})

