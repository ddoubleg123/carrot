import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { activityFor, enrichOfficials, lineupForZip, type FeedItem, type OfficeLine, type Official, type StaffLine } from '@/lib/polWatch'
import { attachProfiles, collapseOfficePosts, ensureOffices, followOffices, settleOfficePosts, storyText, worthSharing } from '@/lib/politicianAccount'
import { sameStory } from '@/lib/curator/judge'
import { invalidateFeedCache } from '@/lib/feedCache'

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function lines(value: unknown, kind: 'office' | 'staff'): OfficeLine[] | StaffLine[] {
  if (!Array.isArray(value)) return []
  if (kind === 'office') {
    return value.flatMap((item) => {
      const row = asRecord(item)
      const phone = typeof row.phone === 'string' ? row.phone : ''
      if (!phone) return []
      return [{ city: typeof row.city === 'string' ? row.city : '', phone, address: typeof row.address === 'string' ? row.address : '' }]
    })
  }
  return value.flatMap((item) => {
    const row = asRecord(item)
    const email = typeof row.email === 'string' ? row.email : ''
    const phone = typeof row.phone === 'string' ? row.phone : ''
    if (!email && !phone) return []
    return [{ name: typeof row.name === 'string' ? row.name : '', role: typeof row.role === 'string' ? row.role : '', email, phone }]
  })
}

function savedPeople(metadata: unknown): Official[] {
  const list = asRecord(metadata).polWatch
  if (!Array.isArray(list)) return []
  return list.flatMap((item) => {
    const row = asRecord(item)
    if (typeof row.id !== 'string' || typeof row.name !== 'string' || typeof row.office !== 'string') return []
    return [{
      id: row.id,
      name: row.name,
      office: row.office,
      party: typeof row.party === 'string' ? row.party : '',
      state: typeof row.state === 'string' ? row.state : '',
      level: row.level === 'state' ? 'state' as const : 'federal' as const,
      handle: typeof row.handle === 'string' ? row.handle : undefined,
      zip: typeof row.zip === 'string' ? row.zip : undefined,
      place: typeof row.place === 'string' ? row.place : undefined,
      phone: typeof row.phone === 'string' ? row.phone : undefined,
      email: typeof row.email === 'string' ? row.email : undefined,
      website: typeof row.website === 'string' ? row.website : undefined,
      contactForm: typeof row.contactForm === 'string' ? row.contactForm : undefined,
      address: typeof row.address === 'string' ? row.address : undefined,
      offices: lines(row.offices, 'office') as OfficeLine[],
      staff: Array.isArray(row.staff) ? lines(row.staff, 'staff') as StaffLine[] : undefined,
      staffChecked: row.staffChecked === true
    }]
  })
}

function seenUrls(metadata: unknown): string[] {
  const list = asRecord(metadata).polWatchSeen
  if (!Array.isArray(list)) return []
  return list.filter((item): item is string => typeof item === 'string')
}

export async function GET(req: Request) {
  const zip = new URL(req.url).searchParams.get('zip') || ''
  if (zip) {
    try {
      const lineup = await lineupForZip(zip)
      const people = await enrichOfficials(lineup.people)
      return NextResponse.json({ ...lineup, people })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'That zip code could not be looked up.'
      return NextResponse.json({ error: message }, { status: 400 })
    }
  }
  const session = await auth()
  const viewerId = (session as { user?: { id?: string } } | null)?.user?.id
  if (!viewerId) return NextResponse.json({ people: [], feed: [] })
  const viewer = await prisma.user.findUnique({ where: { id: viewerId }, select: { metadata: true } })
  const stored = savedPeople(viewer?.metadata)
  const people = stored.length > 0 && stored.every((person) => person.staffChecked)
    ? stored
    : await enrichOfficials(stored)
  const params = new URL(req.url).searchParams
  const topic = (params.get('topic') || '').trim()
  const personId = params.get('person') || ''
  const part = params.get('part') || ''
  if (!topic && part !== 'feed') {
    const accounts = await ensureOffices(people)
    await followOffices(viewerId, [...accounts.values()])
    const moved = await settleOfficePosts(viewerId, people, accounts)
    const collapsed = await collapseOfficePosts([...accounts.values()])
    if (moved || collapsed) invalidateFeedCache()
    if (JSON.stringify(people) !== JSON.stringify(stored)) {
      const fresh = await prisma.user.findUnique({ where: { id: viewerId }, select: { metadata: true } })
      await prisma.user.update({
        where: { id: viewerId },
        data: { metadata: { ...asRecord(fresh?.metadata), polWatch: people } }
      })
    }
    return NextResponse.json({ people: attachProfiles(people, accounts), feed: [] })
  }
  if (topic) {
    const targets = (personId ? people.filter((person) => person.id === personId) : people).slice(0, 8)
    const found = await Promise.all(targets.map((person) => activityFor(person, topic).catch(() => [] as FeedItem[])))
    const stampOf = (value: string) => {
      const time = Date.parse(value || '')
      return Number.isFinite(time) ? time : 0
    }
    return NextResponse.json({ people, feed: found.flat().sort((a, b) => stampOf(b.at) - stampOf(a.at)), topic })
  }
  const groups = await Promise.all(people.slice(0, 12).map((person) => activityFor(person).catch(() => [] as FeedItem[])))
  const stamp = (value: string) => {
    const time = Date.parse(value || '')
    return Number.isFinite(time) ? time : 0
  }
  const feed = groups.flat().sort((a, b) => stamp(b.at) - stamp(a.at))
  const current = await prisma.user.findUnique({ where: { id: viewerId }, select: { metadata: true } })
  const known = seenUrls(current?.metadata)
  const seen = new Set(known)
  const first = !Array.isArray(asRecord(current?.metadata).polWatchSeen)
  const fresh: FeedItem[] = []
  for (const item of feed) {
    if (!item.url || seen.has(item.url)) continue
    seen.add(item.url)
    if (!first && worthSharing(item)) fresh.push(item)
  }
  const meta = asRecord(current?.metadata)
  if (first || fresh.length || JSON.stringify(people) !== JSON.stringify(savedPeople(current?.metadata))) {
    await prisma.user.update({
      where: { id: viewerId },
      data: { metadata: { ...meta, polWatch: people, polWatchSeen: [...seen].slice(-500) } }
    })
  }
  if (fresh.length) {
    const accounts = await ensureOffices(people)
    await followOffices(viewerId, [...accounts.values()])
    const chosen: FeedItem[] = []
    for (const item of fresh) {
      if (chosen.some((kept) => kept.personId === item.personId && sameStory(kept.title, item.title))) continue
      chosen.push(item)
      if (chosen.length >= 4) break
    }
    for (const item of chosen) {
      const account = accounts.get(item.personId)
      if (!account) continue
      const recent = await prisma.post.findMany({
        where: { userId: account.id, createdAt: { gte: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) } },
        select: { content: true },
        take: 20
      })
      if (recent.some((post) => sameStory((post.content || '').split('\n')[0], item.title))) continue
      await prisma.post.create({
        data: {
          userId: account.id,
          content: storyText(item)
        }
      }).catch(() => null)
    }
    invalidateFeedCache()
  }
  return NextResponse.json({ people, feed })
}

export async function POST(req: Request) {
  const session = await auth()
  const viewerId = (session as { user?: { id?: string } } | null)?.user?.id
  if (!viewerId) return NextResponse.json({ error: 'Sign in to keep a watch.' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const people = await enrichOfficials(savedPeople({ polWatch: body?.people }))
  const accounts = await ensureOffices(people)
  const viewer = await prisma.user.findUnique({ where: { id: viewerId }, select: { metadata: true } })
  await prisma.user.update({
    where: { id: viewerId },
    data: { metadata: { ...asRecord(viewer?.metadata), polWatch: people } }
  })
  await followOffices(viewerId, [...accounts.values()])
  return NextResponse.json({ people: attachProfiles(people, accounts) })
}
