import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const prisma = new PrismaClient()

type DedupeReport = {
  key: string
  canonicalId: string
  canonicalName: string
  duplicates: Array<{
    id: string
    name: string
    persona?: string | null
    reason: string
    memories: number
    events: number
  }>
}

function normalizeKey(name: string | null | undefined) {
  return (name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as any
  const apply: boolean = !!body?.apply

  // Strategy: for agents that share the same normalized name, choose a canonical
  // Prefer agents whose persona is NOT 'General knowledge'. Consider others duplicates, especially
  // the ones accidentally created during feeding.
  const agents = await prisma.agent.findMany()

  const byKey = new Map<string, typeof agents>()
  for (const a of agents) {
    const key = normalizeKey(a.name || a.id)
    const list = (byKey.get(key) as any) || []
    list.push(a)
    byKey.set(key, list)
  }

  const reports: DedupeReport[] = []
  for (const [key, list] of byKey.entries()) {
    if (list.length <= 1) continue
    // Pick canonical
    let canonical = list.find(a => (a.persona || '').toLowerCase() !== 'general knowledge') || list[0]
    const dups = list.filter(a => a.id !== canonical.id)

    const dupDetails: DedupeReport['duplicates'] = []
    for (const d of dups) {
      const memCount = await prisma.agentMemory.count({ where: { agentId: d.id } })
      const evtCount = await prisma.agentFeedEvent.count({ where: { agentId: d.id } })
      // Heuristic: mark as duplicate if persona is 'General knowledge' OR no expertise and no metadata
      const isGeneric = (d.persona || '').toLowerCase() === 'general knowledge'
      const noExpertise = Array.isArray((d as any).domainExpertise) ? ((d as any).domainExpertise as any[]).length === 0 : true
      const metaEmpty = !d.metadata || (typeof d.metadata === 'object' && Object.keys(d.metadata as any).length === 0)
      if (!(isGeneric || (noExpertise && metaEmpty))) continue

      dupDetails.push({
        id: d.id,
        name: d.name || d.id,
        persona: d.persona,
        reason: isGeneric ? 'persona=General knowledge' : 'empty profile',
        memories: memCount,
        events: evtCount,
      })
    }

    if (dupDetails.length === 0) continue

    reports.push({
      key,
      canonicalId: canonical.id,
      canonicalName: canonical.name || canonical.id,
      duplicates: dupDetails,
    })
  }

  if (!apply) {
    return NextResponse.json({ ok: true, apply: false, reports })
  }

  // Apply migrations
  for (const r of reports) {
    for (const d of r.duplicates) {
      // Reassign data
      await prisma.agentMemory.updateMany({ where: { agentId: d.id }, data: { agentId: r.canonicalId } })
      await prisma.agentFeedEvent.updateMany({ where: { agentId: d.id }, data: { agentId: r.canonicalId } })
      // Deactivate duplicate agent, keep record
      await prisma.agent.update({
        where: { id: d.id },
        data: {
          isActive: false,
          name: (d.name?.startsWith('dup-') ? d.name : `dup-${d.name}`),
          metadata: { ...(agents.find(a => a.id === d.id)?.metadata as any || {}), dedupedInto: r.canonicalId, dedupedAt: new Date().toISOString() },
        }
      })
    }
  }

  return NextResponse.json({ ok: true, apply: true, reports })
}
