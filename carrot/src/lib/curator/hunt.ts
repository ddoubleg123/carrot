import { mkdir, open, readFile, stat, unlink, writeFile } from 'fs/promises'
import path from 'path'
import { readPublicUrl } from '@/lib/learn/publicUrl'
import { DAILY_CAP, DESKS, type Desk } from '@/lib/curator/desks'
import { judgeReading, sameStory } from '@/lib/curator/judge'
import { publishFinding } from '@/lib/curator/publish'
import { feedItems, fetchText, linksIn, readCaptions, searchPosts, youtubeLatest, type FoundItem } from '@/lib/curator/read'

export interface Dropped {
  title: string
  from: string
  reason: string
}

export interface Kept {
  title: string
  url: string
  from: string
  kind: 'video' | 'page' | 'post'
  words: number
  why: string
  excerpt: string
  topicUrl: string
}

export interface DeskPass {
  id: string
  name: string
  handle: string
  looked: string[]
  dropped: Dropped[]
  kept: Kept[]
}

export interface Hunt {
  at: string
  desks: DeskPass[]
}

export interface Journal {
  updatedAt: string
  hunts: Hunt[]
}

interface Memory {
  seen: string[]
  day: string
  posted: Record<string, number>
  cursor: number
  titles: string[]
  hunted: Record<string, number>
}

const HUNT_WORKERS = 4

const DIR = path.join(process.cwd(), '.cache', 'curator')
const JOURNAL = path.join(DIR, 'journal.json')
const MEMORY = path.join(DIR, 'memory.json')
const LOCK = path.join(DIR, 'lock')

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function canon(url: string): string {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.replace(/^www\./, '')
    if (host === 'youtu.be') return `https://www.youtube.com/watch?v=${parsed.pathname.slice(1).split('/')[0]}`
    if (host.endsWith('youtube.com')) {
      const id = parsed.searchParams.get('v')
      if (id) return `https://www.youtube.com/watch?v=${id}`
    }
    parsed.hash = ''
    parsed.search = ''
    return parsed.toString()
  } catch {
    return url
  }
}

async function loadMemory(): Promise<Memory> {
  const raw = await readFile(MEMORY, 'utf8').catch(() => '')
  const parsed = raw ? JSON.parse(raw) as Memory : null
  const base: Memory = parsed && Array.isArray(parsed.seen) ? parsed : { seen: [], day: today(), posted: {}, cursor: 0, titles: [], hunted: {} }
  if (base.day !== today()) {
    base.day = today()
    base.posted = {}
  }
  base.titles = Array.isArray(base.titles) ? base.titles : []
  base.hunted = base.hunted && typeof base.hunted === 'object' ? base.hunted : {}
  return base
}

async function saveMemory(memory: Memory): Promise<void> {
  await mkdir(DIR, { recursive: true })
  memory.seen = memory.seen.slice(-2500)
  memory.titles = memory.titles.slice(-400)
  await writeFile(MEMORY, JSON.stringify(memory))
}

export async function readJournal(): Promise<Journal | null> {
  const raw = await readFile(JOURNAL, 'utf8').catch(() => '')
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Journal
    return parsed && Array.isArray(parsed.hunts) ? parsed : null
  } catch {
    return null
  }
}

async function saveHunt(hunt: Hunt): Promise<void> {
  const current = await readJournal()
  const hunts = [hunt, ...(current?.hunts || [])].slice(0, 16)
  await mkdir(DIR, { recursive: true })
  await writeFile(JOURNAL, JSON.stringify({ updatedAt: hunt.at, hunts }))
}

function onBeat(desk: Desk, title: string, extra = ''): boolean {
  if (!desk.focus || desk.focus.length === 0) return true
  const hay = `${title} ${extra}`.toLowerCase()
  return desk.focus.some((term) => hay.includes(term.toLowerCase()))
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

function cleanTitle(title: string, publisher: string): string {
  const stripped = title
    .replace(new RegExp(`\\s*[|\\-–—:]\\s*${publisher.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i'), '')
    .replace(/\s+#\w+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return stripped.slice(0, 160) || title.slice(0, 160)
}

let running = false

export interface HuntOptions {
  deskIds?: string[]
  rotate?: boolean
  maxKeep?: number
  channels?: number
  videosPerChannel?: number
  articles?: number
}

async function claimLock(): Promise<boolean> {
  await mkdir(DIR, { recursive: true })
  const info = await stat(LOCK).catch(() => null)
  if (info && Date.now() - info.mtimeMs > 20 * 60 * 1000) await unlink(LOCK).catch(() => undefined)
  try {
    const handle = await open(LOCK, 'wx')
    await handle.close()
    return true
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
    if (code === 'EEXIST') return false
    throw error
  }
}

export async function runCurator(options: HuntOptions = {}): Promise<Hunt> {
  if (running) return { at: new Date().toISOString(), desks: [] }
  if (!(await claimLock())) return { at: new Date().toISOString(), desks: [] }
  running = true
  try {
    return await hunt(options)
  } finally {
    running = false
    await unlink(LOCK).catch(() => undefined)
  }
}

async function hunt(options: HuntOptions): Promise<Hunt> {
  const memory = await loadMemory()
  const maxKeep = options.maxKeep ?? 1
  const channelCount = options.channels ?? 2
  const videosPerChannel = options.videosPerChannel ?? 1
  const articleCount = options.articles ?? 2
  let desks: Desk[]
  if (options.deskIds?.length) {
    desks = DESKS.filter((desk) => options.deskIds?.includes(desk.id))
  } else if (options.rotate) {
    const ready = DESKS.filter((desk) => desk.sources.length > 0)
    if (ready.length === 0) return { at: new Date().toISOString(), desks: [] }
    const ranked = [...ready].sort((a, b) => (memory.hunted[a.id] || 0) - (memory.hunted[b.id] || 0))
    desks = ranked.slice(0, HUNT_WORKERS)
    const now = Date.now()
    for (const desk of desks) memory.hunted[desk.id] = now
    memory.cursor = (memory.cursor + desks.length) % ready.length
  } else {
    desks = DESKS
  }
  const passes: DeskPass[] = []
  await Promise.all(desks.map(async (desk) => {
    const posted = memory.posted[desk.id] || 0
    const pass: DeskPass = { id: desk.id, name: desk.name, handle: desk.handle, looked: [], dropped: [], kept: [] }
    if (posted >= DAILY_CAP) {
      pass.dropped.push({ title: desk.name, from: 'cap', reason: `Already posted ${DAILY_CAP} times today.` })
      passes.push(pass)
      return
    }
    console.log(`[curator] ${desk.name}`)
    const room = () => pass.kept.length < maxKeep && (memory.posted[desk.id] || 0) < DAILY_CAP
    const seenTitle = (title: string) => memory.titles.some((kept) => sameStory(kept, title)) || pass.kept.some((kept) => sameStory(kept.title, title))
    const channels = desk.sources.filter((source) => source.kind === 'youtube').slice(0, channelCount)
    for (const channel of channels) {
      pass.looked.push(`YouTube · ${channel.name}`)
      const latest = await youtubeLatest(channel.ref).catch(() => [] as FoundItem[])
      if (latest.length === 0) {
        pass.dropped.push({ title: channel.name, from: 'YouTube', reason: 'The channel feed could not be read.' })
        continue
      }
      let attempts = 0
      for (const item of latest) {
        if (!room() || attempts >= videosPerChannel) break
        const url = canon(item.url)
        if (memory.seen.includes(url)) continue
        const title = cleanTitle(item.title, channel.name)
        if (!onBeat(desk, title)) continue
        if (seenTitle(title)) {
          pass.dropped.push({ title, from: channel.name, reason: 'A desk already kept this story.' })
          memory.seen.push(url)
          continue
        }
        attempts += 1
        console.log(`[curator] captions ${title}`)
        const captions = await readCaptions(url)
        memory.seen.push(url)
        if (!captions) {
          pass.dropped.push({ title, from: channel.name, reason: 'No English captions, so the talk was not judged.' })
          continue
        }
        const reading = judgeReading(captions, title, 'video')
        if (!reading.keep) {
          pass.dropped.push({ title, from: channel.name, reason: `${reading.reason} (${reading.words} words)` })
          continue
        }
        const published = await publishFinding(desk, {
          title,
          url,
          domain: 'youtube.com',
          excerpt: reading.excerpt,
          summary: reading.summary,
          publisher: channel.name
        }).catch((error) => {
          pass.dropped.push({ title, from: channel.name, reason: error instanceof Error ? error.message : 'The page could not be opened.' })
          return null
        })
        if (!published) continue
        pass.kept.push({
          title,
          url,
          from: channel.name,
          kind: 'video',
          words: reading.words,
          why: `Captions read, ${reading.words} words. ${reading.reason}`,
          excerpt: reading.excerpt,
          topicUrl: published.topicUrl
        })
        memory.posted[desk.id] = (memory.posted[desk.id] || 0) + 1
        memory.titles.push(title)
        console.log(`[curator] kept ${title}`)
      }
    }
    const feeds = desk.sources.filter((source) => source.kind === 'rss').slice(0, 2)
    let articles = 0
    for (const feed of feeds) {
      pass.looked.push(`Feed · ${feed.name}`)
      const xml = await fetchText(feed.ref)
      const items = xml ? feedItems(xml, desk.focus?.length ? 24 : 8) : []
      if (!xml) {
        pass.dropped.push({ title: feed.name, from: 'Feed', reason: 'The feed could not be read.' })
        continue
      }
      for (const item of items) {
        if (!room() || articles >= articleCount) break
        const url = canon(item.url)
        if (memory.seen.includes(url) || domainOf(url).includes('youtube.com')) continue
        const title = cleanTitle(item.title, feed.name)
        if (!onBeat(desk, title, item.blurb || '')) continue
        if (seenTitle(title)) {
          memory.seen.push(url)
          continue
        }
        articles += 1
        memory.seen.push(url)
        console.log(`[curator] page ${title}`)
        const page = await readPublicUrl(url).catch(() => null)
        const text = page?.text || ''
        const reading = judgeReading(text || item.blurb || '', page?.title || title, 'page')
        if (!reading.keep) {
          pass.dropped.push({ title, from: feed.name, reason: reading.reason })
          continue
        }
        const published = await publishFinding(desk, {
          title: cleanTitle(page?.title || title, feed.name),
          url: page?.finalUrl || url,
          domain: domainOf(page?.finalUrl || url),
          excerpt: reading.excerpt,
          summary: reading.summary,
          publisher: feed.name,
          image: page?.image
        }).catch(() => null)
        if (!published) {
          pass.dropped.push({ title, from: feed.name, reason: 'The page was worth keeping, but it could not be posted.' })
          continue
        }
        pass.kept.push({
          title: cleanTitle(page?.title || title, feed.name),
          url: page?.finalUrl || url,
          from: feed.name,
          kind: 'page',
          words: reading.words,
          why: `Page read, ${reading.words} words. ${reading.reason}`,
          excerpt: reading.excerpt,
          topicUrl: published.topicUrl
        })
        memory.posted[desk.id] = (memory.posted[desk.id] || 0) + 1
        memory.titles.push(title)
      }
    }
    const accounts = desk.sources.filter((source) => source.kind === 'x').slice(0, 1)
    for (const account of accounts) {
      pass.looked.push(`X · ${account.name}`)
      const posts = await searchPosts(account.ref).catch(() => [] as FoundItem[])
      if (posts.length === 0) {
        pass.dropped.push({ title: account.name, from: 'X', reason: 'No recent posts came back from that account.' })
        continue
      }
      const post = posts.find((item) => linksIn(item.blurb || '').some((link) => !/x\.com|twitter\.com|t\.co/.test(link))) || posts[0]
      const outbound = linksIn(post.blurb || '').find((link) => !/x\.com|twitter\.com|t\.co/.test(link))
      if (!outbound || !room()) {
        pass.dropped.push({ title: post.title, from: account.name, reason: outbound ? 'The desk already kept enough from this pass.' : 'The post does not point at a page or a video to read.' })
        continue
      }
      const url = canon(outbound)
      if (memory.seen.includes(url)) {
        pass.dropped.push({ title: post.title, from: account.name, reason: 'The page it points at was already seen.' })
        continue
      }
      memory.seen.push(url)
      const host = domainOf(url)
      const video = host.includes('youtube.com') || host === 'youtu.be'
      console.log(`[curator] x lead ${host}`)
      const page = video ? null : await readPublicUrl(url).catch(() => null)
      const body = video ? await readCaptions(url) : page?.text || ''
      const reading = judgeReading(body, post.title, video ? 'video' : 'page')
      if (!reading.keep) {
        pass.dropped.push({ title: post.title, from: account.name, reason: `The link was read. ${reading.reason}` })
        continue
      }
      const published = await publishFinding(desk, {
        title: cleanTitle(post.title, account.name),
        url,
        domain: host,
        excerpt: reading.excerpt,
        summary: reading.summary,
        publisher: account.name,
        image: page?.image
      }).catch(() => null)
      if (!published) {
        pass.dropped.push({ title: post.title, from: account.name, reason: 'The link was worth keeping, but it could not be posted.' })
        continue
      }
      pass.kept.push({
        title: cleanTitle(post.title, account.name),
        url,
        from: account.name,
        kind: video ? 'video' : 'page',
        words: reading.words,
        why: `Found from an X post, then read (${reading.words} words).`,
        excerpt: reading.excerpt,
        topicUrl: published.topicUrl
      })
      memory.posted[desk.id] = (memory.posted[desk.id] || 0) + 1
      memory.titles.push(post.title)
    }
    passes.push(pass)
  }))
  const result: Hunt = { at: new Date().toISOString(), desks: passes }
  await saveMemory(memory)
  await saveHunt(result)
  return result
}

export function armCurator(): void {
  const holder = globalThis as unknown as { __carrotCurator?: ReturnType<typeof setInterval> }
  if (holder.__carrotCurator) return
  const pass = () => {
    void runCurator({ rotate: true, maxKeep: 1, channels: 2, videosPerChannel: 1, articles: 1 }).catch((error) => {
      console.error('[curator] pass failed', error instanceof Error ? error.message : error)
    })
  }
  holder.__carrotCurator = setInterval(pass, 20 * 1000)
  holder.__carrotCurator.unref?.()
  pass()
}
