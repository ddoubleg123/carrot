import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { curatorAllowed } from '@/lib/curator/access'
import { FEED_RANK_DEFAULTS, normalizeFeedRank } from '@/lib/feedRank'
import { clearFeedRankCache, loadFeedRank, saveFeedRank } from '@/lib/feedRankStore'
import { interestGroups } from '@/lib/interestCatalog'
import { picksFrom, saveInterestPicks } from '@/lib/recordInterest'

export const dynamic = 'force-dynamic'

async function asks() {
  const rows = await prisma.$queryRaw<Array<{ id: string; metadata: unknown }>>`
    SELECT id, metadata FROM "User"
    WHERE metadata ? 'interestPicks'
    LIMIT 1000
  `.catch(() => [])
  const grouped = new Map<string, { label: string; terms: string[]; count: number }>()
  for (const row of rows) {
    for (const pick of picksFrom(row.metadata)) {
      if (pick.kind !== 'ask') continue
      const key = pick.label.toLowerCase()
      const current = grouped.get(key) || { label: pick.label, terms: [], count: 0 }
      current.count += 1
      current.terms = [...new Set([...current.terms, ...pick.terms])].slice(0, 8)
      grouped.set(key, current)
    }
  }
  return [...grouped.values()].sort((a, b) => b.count - a.count)
}

export async function GET() {
  if (!(await curatorAllowed())) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const config = await loadFeedRank()
  return NextResponse.json({ config, asks: await asks(), groups: interestGroups(config.extraTerms) })
}

async function fileUnder(label: string, deskId: string) {
  const desk = interestGroups().find((group) => group.id === deskId)
  if (!desk) return
  const rows = await prisma.$queryRaw<Array<{ id: string; metadata: unknown }>>`
    SELECT id, metadata FROM "User"
    WHERE metadata ? 'interestPicks'
    LIMIT 1000
  `
  for (const row of rows) {
    const picks = picksFrom(row.metadata)
    const hit = picks.some((pick) => pick.kind === 'ask' && pick.label.toLowerCase() === label.toLowerCase())
    if (!hit) continue
    const terms = new Set<string>()
    for (const pick of picks) {
      if (pick.kind === 'ask' && pick.label.toLowerCase() === label.toLowerCase()) {
        pick.terms.forEach((term) => terms.add(term))
        terms.add(label.toLowerCase())
      }
    }
    const next = picks.flatMap((pick) => {
      if (pick.kind === 'ask' && pick.label.toLowerCase() === label.toLowerCase()) return []
      if (pick.id === desk.id) return [{ ...pick, terms: [...new Set([...pick.terms, ...terms])].slice(0, 5) }]
      return [pick]
    })
    if (!next.some((pick) => pick.id === desk.id)) {
      next.unshift({ id: desk.id, label: desk.name, terms: [...terms].slice(0, 5), kind: 'desk' })
    }
    if (next.length < 3) continue
    await saveInterestPicks(row.id, next)
  }
}

export async function POST(req: Request) {
  if (!(await curatorAllowed())) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const body = await req.json().catch(() => ({}))
  if (body?.action === 'reset') {
    clearFeedRankCache()
    const config = await saveFeedRank(FEED_RANK_DEFAULTS)
    return NextResponse.json({ config, asks: await asks() })
  }
  if (body?.action === 'term') {
    const deskId = String(body.deskId || '')
    const word = String(body.word || '').trim().toLowerCase()
    if (!interestGroups().some((group) => group.id === deskId) || word.length < 3) {
      return NextResponse.json({ error: 'Pick a group and a word.' }, { status: 400 })
    }
    const current = await loadFeedRank()
    const words = [...new Set([...(current.extraTerms[deskId] || []), word])].slice(0, 20)
    const config = await saveFeedRank({ ...current, extraTerms: { ...current.extraTerms, [deskId]: words } })
    return NextResponse.json({ config, asks: await asks() })
  }
  if (body?.action === 'file') {
    const label = String(body.label || '').trim()
    const deskId = String(body.deskId || '')
    const word = label.toLowerCase()
    if (!label || !interestGroups().some((group) => group.id === deskId)) {
      return NextResponse.json({ error: 'Pick a group.' }, { status: 400 })
    }
    const current = await loadFeedRank()
    const words = [...new Set([...(current.extraTerms[deskId] || []), word])].slice(0, 20)
    const config = await saveFeedRank({ ...current, extraTerms: { ...current.extraTerms, [deskId]: words } })
    await fileUnder(label, deskId)
    return NextResponse.json({ config, asks: await asks() })
  }
  const config = await saveFeedRank(normalizeFeedRank({ ...(await loadFeedRank()), ...body?.config }))
  return NextResponse.json({ config, asks: await asks() })
}
