import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { activityFor, enrichOfficials, lineupForZip, uniqueStaff, type FeedItem, type OfficeLine, type Official, type StaffLine } from '@/lib/polWatch'
import { attachProfiles, collapseOfficePosts, ensureOffices, followOffices, officePost, settleOfficePosts, worthSharing } from '@/lib/politicianAccount'
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
      staff: Array.isArray(row.staff) ? uniqueStaff(lines(row.staff, 'staff') as StaffLine[]) : undefined,
      staffChecked: row.staffChecked === true,
      staffMark: row.staffMark === 2 ? 2 : undefined
    }]
  })
}

function partyLetter(party: string) {
  if (/dem|^d$/i.test(party.trim())) return 'D'
  if (/rep|^r$/i.test(party.trim())) return 'R'
  return ''
}

/** Stories for the home rail. Read only: no office setup, no seen-list writes, no new posts. */
async function railStories(people: Official[]) {
  const watched = people.slice(0, 12)
  const groups = await Promise.all(watched.map((person) => activityFor(person).catch(() => [] as FeedItem[])))
  const picked = groups.map((items) => items.slice(0, 6))
  const items: { id: string; name: string; office: string; place: string; party: string; line: string; source: string; kind: FeedItem['kind']; url: string }[] = []
  const depth = picked.reduce((max, list) => Math.max(max, list.length), 0)
  for (let slot = 0; slot < depth && items.length < 24; slot++) {
    for (let index = 0; index < watched.length && items.length < 24; index++) {
      const item = picked[index][slot]
      if (!item?.title || !item.url) continue
      const person = watched[index]
      items.push({
        id: item.id,
        name: person.name,
        office: person.office,
        place: person.place || person.state,
        party: partyLetter(person.party),
        line: item.title.replace(/\s+/g, ' ').trim(),
        source: item.source,
        kind: item.kind,
        url: item.url
      })
    }
  }
  return { count: watched.length, items }
}

const railMemory = new Map<string, { at: number; body: { count: number; items: Awaited<ReturnType<typeof railStories>>['items'] } }>()
const railJobs = new Map<string, Promise<void>>()

function rememberRail(viewerId: string, people: Official[]) {
  if (railJobs.has(viewerId)) return
  const job = railStories(people).then((body) => {
    railMemory.set(viewerId, { at: Date.now(), body })
  }).catch(() => {}).finally(() => {
    railJobs.delete(viewerId)
  })
  railJobs.set(viewerId, job)
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
  if (new URL(req.url).searchParams.get('part') === 'rail') {
    const hit = railMemory.get(viewerId)
    const fresh = hit && Date.now() - hit.at < 3 * 60 * 1000
    if (!fresh) rememberRail(viewerId, stored)
    return NextResponse.json(fresh && hit ? hit.body : { count: stored.length, items: hit?.body.items || [], pending: true })
  }
  const people = stored.length > 0 && stored.every((person) => person.staffChecked && person.staffMark === 2)
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
      if (recent.some((post) => sameStory(post.content || '', item.title))) continue
      const content = await officePost(item).catch(() => null)
      if (!content) continue
      await prisma.post.create({
        data: {
          userId: account.id,
          content,
          bucket: 'pol-watch'
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
