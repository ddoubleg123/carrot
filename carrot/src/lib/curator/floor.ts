import prisma from '@/lib/prisma'
import { DAILY_CAP, DESKS, type Desk } from '@/lib/curator/desks'

export interface FloorPost {
  id: string
  at: string
  deskId: string
  name: string
  handle: string
  username: string
  avatar: string
  beat: string
  title: string
  note: string
  source: string
  topicUrl: string
}

export interface FloorDesk {
  id: string
  name: string
  handle: string
  username: string
  avatar: string
  beat: string
  today: number
  cap: number
  lastAt: string | null
  lastTitle: string
}

export interface FloorSnapshot {
  at: string
  desksTotal: number
  postedToday: number
  postedHour: number
  desksWorking: number
  desksToday: number
  desksQuiet: number
  desksAtCap: number
  buckets: number[]
  posts: FloorPost[]
  roster: FloorDesk[]
}

const WINDOW_MS = 36 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000
const WORKING_MS = 15 * 60 * 1000
const POST_TAKE = 800
const FEED_TAKE = 60

function decode(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, n: string) => {
      const code = Number(n)
      return Number.isFinite(code) ? String.fromCharCode(code) : ''
    })
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function readPost(content: string): { title: string; note: string; topicUrl: string; source: string } {
  const lines = content.split('\n').map((line) => line.trim()).filter(Boolean)
  let topicUrl = ''
  let source = ''
  const prose: string[] = []
  for (const line of lines) {
    if (line.startsWith('/patch/')) {
      if (!topicUrl) topicUrl = line
      continue
    }
    if (/^https?:\/\//i.test(line)) {
      if (!source) source = line
      continue
    }
    if (/^(Title|When|From|Image):/i.test(line)) {
      if (/^Title:/i.test(line) && prose.length === 0) prose.push(decode(line.replace(/^Title:\s*/i, '')))
      continue
    }
    prose.push(decode(line))
  }
  const note = prose[1] ? prose[0] : ''
  const title = (prose[1] || prose[0] || 'Untitled').slice(0, 180)
  return { title, note: note.slice(0, 240), topicUrl, source }
}

function utcDayStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

function deskIndex(): Map<string, Desk> {
  const map = new Map<string, Desk>()
  for (const desk of DESKS) {
    map.set(desk.username, desk)
    map.set(desk.priorUsername, desk)
  }
  return map
}

export async function loadFloor(now = new Date()): Promise<FloorSnapshot> {
  const known = deskIndex()
  const usernames = [...known.keys()]
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { email: { endsWith: '@bots.carrot.invalid' } },
        { username: { in: usernames } }
      ]
    },
    select: { id: true, username: true, name: true, profilePhoto: true, image: true }
  })
  const since = new Date(now.getTime() - WINDOW_MS)
  const rows = users.length === 0
    ? []
    : await prisma.post.findMany({
      where: { userId: { in: users.map((user) => user.id) }, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: POST_TAKE,
      select: { id: true, userId: true, content: true, createdAt: true }
    })

  const userById = new Map(users.map((user) => [user.id, user]))
  const dayStart = utcDayStart(now).getTime()
  const hourStart = now.getTime() - HOUR_MS
  const buckets = Array.from({ length: 12 }, () => 0)
  const posts: FloorPost[] = []
  const tally = new Map<string, { today: number; lastAt: string | null; lastTitle: string }>()

  for (const row of rows) {
    const user = userById.get(row.userId)
    if (!user) continue
    const username = user.username || ''
    const desk = username ? known.get(username) : undefined
    const parsed = readPost(row.content || '')
    const at = row.createdAt.toISOString()
    const stamp = row.createdAt.getTime()
    const item: FloorPost = {
      id: row.id,
      at,
      deskId: desk?.id || user.id,
      name: desk?.name || user.name || username || 'Desk',
      handle: desk?.handle || '',
      username: desk?.username || username,
      avatar: desk?.avatar || user.profilePhoto || user.image || '',
      beat: desk?.beat || '',
      title: parsed.title,
      note: parsed.note,
      source: parsed.source,
      topicUrl: parsed.topicUrl
    }
    if (posts.length < FEED_TAKE) posts.push(item)
    const slot = tally.get(item.deskId) || { today: 0, lastAt: null, lastTitle: '' }
    if (!slot.lastAt) {
      slot.lastAt = at
      slot.lastTitle = item.title
    }
    if (stamp >= dayStart) slot.today += 1
    tally.set(item.deskId, slot)
    if (stamp >= hourStart) {
      const index = 11 - Math.min(11, Math.floor((now.getTime() - stamp) / (5 * 60 * 1000)))
      buckets[index] += 1
    }
  }

  const seen = new Set<string>()
  const roster: FloorDesk[] = DESKS.map((desk) => {
    seen.add(desk.id)
    const slot = tally.get(desk.id)
    return {
      id: desk.id,
      name: desk.name,
      handle: desk.handle,
      username: desk.username,
      avatar: desk.avatar,
      beat: desk.beat,
      today: slot?.today || 0,
      cap: DAILY_CAP,
      lastAt: slot?.lastAt || null,
      lastTitle: slot?.lastTitle || ''
    }
  })
  for (const [deskId, slot] of tally) {
    if (seen.has(deskId)) continue
    const sample = posts.find((post) => post.deskId === deskId)
    roster.push({
      id: deskId,
      name: sample?.name || 'Desk',
      handle: sample?.handle || '',
      username: sample?.username || '',
      avatar: sample?.avatar || '',
      beat: sample?.beat || '',
      today: slot.today,
      cap: DAILY_CAP,
      lastAt: slot.lastAt,
      lastTitle: slot.lastTitle
    })
  }
  roster.sort((a, b) => {
    if (a.lastAt && b.lastAt) return a.lastAt < b.lastAt ? 1 : -1
    if (a.lastAt) return -1
    if (b.lastAt) return 1
    return a.name.localeCompare(b.name)
  })

  const workingCutoff = now.getTime() - WORKING_MS
  return {
    at: now.toISOString(),
    desksTotal: roster.length,
    postedToday: roster.reduce((sum, desk) => sum + desk.today, 0),
    postedHour: buckets.reduce((sum, n) => sum + n, 0),
    desksWorking: roster.filter((desk) => desk.lastAt && Date.parse(desk.lastAt) >= workingCutoff).length,
    desksToday: roster.filter((desk) => desk.today > 0).length,
    desksQuiet: roster.filter((desk) => desk.today === 0).length,
    desksAtCap: roster.filter((desk) => desk.today >= desk.cap).length,
    buckets,
    posts,
    roster
  }
}
