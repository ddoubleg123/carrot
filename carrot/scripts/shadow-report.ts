import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function hostFromUrl(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return null
  }
}

async function main() {
  const runId = process.argv[2]
  if (!runId) {
    throw new Error('Usage: tsx scripts/shadow-report.ts <runId>')
  }

  const run = await prisma.discoveryRun.findUnique({
    where: { id: runId },
    select: { id: true, patchId: true, status: true, metrics: true, startedAt: true }
  })
  if (!run) {
    throw new Error(`Run ${runId} not found`)
  }

  const events = await prisma.discoveryAudit.findMany({
    where: { runId },
    orderBy: { ts: 'asc' }
  })

  const frontierEvents = events.filter((evt) => evt.step === 'frontier_pop')
  const first20 = frontierEvents.slice(0, 20)
  const first12 = frontierEvents.slice(0, 12)

  const first20Hosts = first20.map((evt) => hostFromUrl(evt.candidateUrl))
  const distinctFirst20Hosts = Array.from(new Set(first20Hosts.filter((host): host is string => Boolean(host))))

  const angleCounts = new Map<string, number>()
  first12.forEach((evt) => {
    const angle = (evt.meta as any)?.angle ?? 'unknown'
    angleCounts.set(angle, (angleCounts.get(angle) ?? 0) + 1)
  })

  const viewpointCounts = new Map<string, number>()
  first12.forEach((evt) => {
    const viewpoint = (evt.meta as any)?.stance ?? (evt.meta as any)?.viewpoint ?? 'unknown'
    viewpointCounts.set(viewpoint, (viewpointCounts.get(viewpoint) ?? 0) + 1)
  })

  const whyRejected = new Map<string, number>()
  events.forEach((evt) => {
    const reason = (evt.decisions as any)?.reason || (evt.meta as any)?.reason
    if (!reason) return
    whyRejected.set(reason, (whyRejected.get(reason) ?? 0) + 1)
  })

  const paywallEvents = events.filter((evt) => evt.step === 'fetch' && (evt.meta as any)?.reason === 'paywall')

  const cooldownHits = events.filter((evt) => evt.step === 'cooldown').length

  const attemptCount = run.metrics?.candidatesProcessed ?? frontierEvents.length
  const firstSaveIndex = events.findIndex((evt) => evt.step === 'save' && evt.status === 'ok')

  const summary = {
    runId: run.id,
    patchId: run.patchId,
    attemptsToFirstSave: firstSaveIndex === -1 ? null : firstSaveIndex,
    totalAttempts: attemptCount,
    first20Hosts,
    distinctFirst20HostCount: distinctFirst20Hosts.length,
    first12AngleCounts: Object.fromEntries(angleCounts.entries()),
    first12ViewpointCounts: Object.fromEntries(viewpointCounts.entries()),
    whyRejected: Array.from(whyRejected.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count),
    paywallEvents: paywallEvents.length,
    cooldownHits,
    runMetrics: run.metrics ?? null
  }

  console.dir(summary, { depth: null })
}

main()
  .catch((err) => {
    console.error(err)
  })
  .finally(() => {
    prisma.$disconnect().catch(() => undefined)
  })
