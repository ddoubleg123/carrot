import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { Prisma } from '@prisma/client'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { generateGuideSnapshot, seedFrontierFromPlan, type DiscoveryPlan } from '@/lib/discovery/planner'
import {
  isDiscoveryKillSwitchEnabled,
  isDiscoveryV2Enabled,
  isPatchForceStopped
} from '@/lib/discovery/flags'

export const dynamic = 'force-dynamic'

function buildTopicAndAliases(patch: {
  title: string
  tags: Prisma.JsonValue | null
  entity: Prisma.JsonValue | null
}): { topic: string; aliases: string[] } {
  const entity = (patch.entity ?? {}) as { name?: string; aliases?: string[] }
  const topic = entity?.name && entity.name.trim().length ? entity.name.trim() : patch.title
  const aliases =
    Array.isArray(entity?.aliases) && entity.aliases.length
      ? entity.aliases
          .map((value) => (typeof value === 'string' ? value.trim() : ''))
          .filter((value) => value.length > 0)
      : Array.isArray(patch.tags)
        ? (patch.tags as unknown[])
            .map((value) => (typeof value === 'string' ? value.trim() : ''))
            .filter((value) => value.length > 0)
        : []

  return { topic, aliases }
}

function hashPlan(plan: DiscoveryPlan): string {
  const canonical = JSON.stringify(plan)
  return createHash('sha1').update(canonical).digest('hex')
}

function summariseSeedHosts(plan: DiscoveryPlan) {
  const counts = new Map<string, number>()
  for (const seed of plan.seedCandidates ?? []) {
    if (!seed?.url) continue
    try {
      const host = new URL(seed.url).hostname.toLowerCase()
      counts.set(host, (counts.get(host) ?? 0) + 1)
    } catch {
      counts.set('invalid', (counts.get('invalid') ?? 0) + 1)
    }
  }
  return Array.from(counts.entries()).map(([host, count]) => ({ host, count }))
}

export async function POST(request: Request) {
  if (!isDiscoveryV2Enabled()) {
    return NextResponse.json({ error: 'DISCOVERY_V2 flag disabled' }, { status: 403 })
  }

  if (isDiscoveryKillSwitchEnabled()) {
    return NextResponse.json({ error: 'Discovery kill switch active' }, { status: 503 })
  }

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const handle = url.searchParams.get('patch')?.trim()
  if (!handle) {
    return NextResponse.json({ error: 'Missing patch handle (?patch=handle)' }, { status: 400 })
  }

  if (isPatchForceStopped(handle)) {
    return NextResponse.json({ error: `Patch "${handle}" is force-stopped` }, { status: 423 })
  }

  const patch = await prisma.patch.findUnique({
    where: { handle },
    select: {
      id: true,
      handle: true,
      title: true,
      tags: true,
      entity: true,
      guide: true
    }
  })

  if (!patch) {
    return NextResponse.json({ error: `Patch "${handle}" not found` }, { status: 404 })
  }

  if (isPatchForceStopped(patch.id)) {
    return NextResponse.json({ error: `Patch "${handle}" is force-stopped` }, { status: 423 })
  }

  let plan: DiscoveryPlan
  let generated = false

  const { topic, aliases } = buildTopicAndAliases(patch)

  if (patch.guide) {
    plan = patch.guide as unknown as DiscoveryPlan
  } else {
    plan = await generateGuideSnapshot(topic, aliases)
    await prisma.patch.update({
      where: { id: patch.id },
      data: { guide: plan as unknown as Prisma.JsonObject }
    })
    generated = true
  }

  await seedFrontierFromPlan(patch.id, plan)

  const seedsQueued = plan.seedCandidates?.length ?? 0
  const hostSummary = summariseSeedHosts(plan)

  return NextResponse.json({
    success: true,
    generated,
    planHash: hashPlan(plan),
    patch: {
      id: patch.id,
      handle: patch.handle,
      title: patch.title,
      topic,
      aliases
    },
    seedsQueued,
    hosts: hostSummary
  })
}


