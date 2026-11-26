import { mkdir, open, readFile, stat, unlink, writeFile } from 'fs/promises'
import path from 'path'
import { readPublicUrl } from '@/lib/learn/publicUrl'
import { chooseDesk, isPast } from '@/lib/curator/assign'
import { listChannels, recentUploads } from '@/lib/curator/channels'
import { DAILY_CAP, DESKS, type Desk } from '@/lib/curator/desks'
import { judgeReading, sameStory } from '@/lib/curator/judge'
import { alreadyPosted, publishFinding } from '@/lib/curator/publish'
import { feedItems, fetchText, linksIn, readCaptions, searchPosts, youtubeLatest, type FoundItem } from '@/lib/curator/read'
import { profileQrUrl } from '@/lib/learn/brandClip'
import { ensureMediaBins } from '@/lib/mediaBins'
import { runQaMonitor } from '@/lib/curator/qaMonitor'
import { storeClip } from '@/lib/curator/storeClip'
import { startClipOnce } from '@/lib/learn/clipOnce'
import { citedPages } from '@/lib/curator/wikiRefs'
import { applyCardNames, readNameCard } from '@/lib/learn/nameCard'

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
  captionMiss: Record<string, number>
}

const HUNT_WORKERS = 4
const WATCH_READS = 4
const WATCH_POSTS = 2

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
  const base: Memory = parsed && Array.isArray(parsed.seen) ? parsed : { seen: [], day: today(), posted: {}, cursor: 0, titles: [], hunted: {}, captionMiss: {} }
  if (base.day !== today()) {
    base.day = today()
    base.posted = {}
  }
  base.titles = Array.isArray(base.titles) ? base.titles : []
  base.hunted = base.hunted && typeof base.hunted === 'object' ? base.hunted : {}
  base.captionMiss = base.captionMiss && typeof base.captionMiss === 'object' ? base.captionMiss : {}
  return base
}

async function saveMemory(memory: Memory): Promise<void> {
  await mkdir(DIR, { recursive: true })
  memory.seen = memory.seen.slice(-2500)
  memory.titles = memory.titles.slice(-400)
  const cutoff = Date.now() - 6 * 60 * 60 * 1000
  memory.captionMiss = Object.fromEntries(Object.entries(memory.captionMiss || {}).filter(([, at]) => at > cutoff))
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

function feedWindow(desk: Desk, postedToday: number): Desk['sources'] {
  const feeds = desk.sources.filter((source) => source.kind === 'rss')
  if (feeds.length <= 2) return feeds
  const start = (Math.floor(Date.now() / 3_600_000) + postedToday) % feeds.length
  return [0, 1].map((step) => feeds[(start + step) % feeds.length])
}

function onBeat(desk: Desk, title: string, extra = ''): boolean {
  const hay = `${title} ${extra}`.toLowerCase()
  if (desk.past && !isPast(hay)) return false
  if (!desk.focus || desk.focus.length === 0) return true
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
  clipsOnly?: boolean
  /** Desk pages only. The clip pass already read the watched channels. */
  skipWatch?: boolean
  /** How many groups the rotating pass reads. */
  maxDesks?: number
}

async function claimLock(): Promise<boolean> {
  await mkdir(DIR, { recursive: true })
  const info = await stat(LOCK).catch(() => null)
  if (info && Date.now() - info.mtimeMs > 90 * 60 * 1000) await unlink(LOCK).catch(() => undefined)
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
  if (await stat(path.join(DIR, 'pause')).then(() => true).catch(() => false)) {
    return { at: new Date().toISOString(), desks: [] }
  }
  const memory = await loadMemory()
  if (options.clipsOnly) {
    const passes: DeskPass[] = []
    await watchChannels(memory, passes)
    const result: Hunt = { at: new Date().toISOString(), desks: passes }
    await saveMemory(memory)
    await saveHunt(result)
    return result
  }
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
    desks = ranked.slice(0, options.maxDesks ?? HUNT_WORKERS)
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
    const feeds = feedWindow(desk, memory.posted[desk.id] || 0)
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
        }).catch((error) => {
          pass.dropped.push({ title, from: feed.name, reason: error instanceof Error ? error.message : 'The page could not be posted.' })
          return null
        })
        if (!published) {
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
    if (room()) {
      pass.looked.push('Wikipedia · cited pages')
      const cited = await citedPages(desk.name).catch(() => [] as string[])
      let tried = 0
      for (const raw of cited) {
        if (!room() || tried >= 2) break
        const url = canon(raw)
        if (memory.seen.includes(url)) continue
        tried += 1
        memory.seen.push(url)
        const host = domainOf(url)
        console.log(`[curator] wiki ${host}`)
        const page = await readPublicUrl(url).catch(() => null)
        const text = page?.text || ''
        const title = cleanTitle(page?.title || desk.name, host)
        const reading = judgeReading(text, title, 'page')
        if (!reading.keep) {
          pass.dropped.push({ title, from: 'Wikipedia', reason: reading.reason })
          continue
        }
        const published = await publishFinding(desk, {
          title,
          url: page?.finalUrl || url,
          domain: domainOf(page?.finalUrl || url),
          excerpt: reading.excerpt,
          summary: reading.summary,
          publisher: host,
          image: page?.image
        }).catch((error) => {
          pass.dropped.push({ title, from: 'Wikipedia', reason: error instanceof Error ? error.message : 'The cited page could not be posted.' })
          return null
        })
        if (!published) continue
        pass.kept.push({
          title,
          url: page?.finalUrl || url,
          from: host,
          kind: 'page',
          words: reading.words,
          why: `Cited from Wikipedia, ${reading.words} words. ${reading.reason}`,
          excerpt: reading.excerpt,
          topicUrl: published.topicUrl
        })
        memory.posted[desk.id] = (memory.posted[desk.id] || 0) + 1
        memory.titles.push(title)
        console.log(`[curator] kept ${title}`)
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
      const body = (video ? await readCaptions(url) : page?.text) || ''
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
  if (!options.skipWatch) await watchChannels(memory, passes)
  const result: Hunt = { at: new Date().toISOString(), desks: passes }
  await saveMemory(memory)
  await saveHunt(result)
  return result
}

async function watchChannels(memory: Memory, passes: DeskPass[]): Promise<void> {
  const channels = await listChannels().catch(() => [])
  let kept = 0
  let attempts = 0
  for (const channel of channels) {
    if (kept >= WATCH_POSTS || attempts >= WATCH_READS) break
    passes.find((pass) => pass.id === 'watch') || passes.push({ id: 'watch', name: 'Watched channels', handle: 'channels', looked: [], dropped: [], kept: [] })
    const watch = passes.find((pass) => pass.id === 'watch')
    watch?.looked.push(`YouTube · ${channel.name}`)
    const latest = await recentUploads(channel.channelId).catch(() => [] as FoundItem[])
    if (latest.length === 0) {
      watch?.dropped.push({ title: channel.name, from: 'YouTube', reason: 'No video from the last 3 days.' })
      continue
    }
    for (const item of latest) {
      if (kept >= WATCH_POSTS || attempts >= WATCH_READS) break
      const url = canon(item.url)
      if (memory.seen.includes(url) || Date.now() - (memory.captionMiss[url] || 0) < 30 * 60 * 1000) continue
      if (await alreadyPosted({ url, sourceUrl: url })) {
        memory.seen.push(url)
        continue
      }
      const title = cleanTitle(item.title, channel.name)
      if (memory.titles.some((keptTitle) => sameStory(keptTitle, title))) {
        memory.seen.push(url)
        continue
      }
      if (attempts >= WATCH_READS) break
      attempts += 1
      console.log(`[curator] channel ${channel.name}`)
      const captions = await readCaptions(url)
      if (!captions) {
        memory.captionMiss[url] = Date.now()
        watch?.dropped.push({ title, from: channel.name, reason: 'No English captions on this pass.' })
        continue
      }
      memory.seen.push(url)
      const reading = judgeReading(captions, title, 'video')
      if (!reading.keep) {
        watch?.dropped.push({ title, from: channel.name, reason: reading.reason })
        continue
      }
      const desk = chooseDesk(`${title} ${reading.excerpt}`)
      if ((memory.posted[desk.id] || 0) >= DAILY_CAP) {
        watch?.dropped.push({ title, from: desk.name, reason: `Already posted ${DAILY_CAP} times today.` })
        continue
      }
      const clipJob = await startClipOnce({ url, pageUrl: profileQrUrl(desk.username) })
      for (let wait = 0; wait < 300 && clipJob.status === 'running'; wait += 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000))
      }
      const clip = clipJob.clips[0]
      if (clipJob.status !== 'completed' || !clip?.src) {
        watch?.dropped.push({ title, from: channel.name, reason: clipJob.error || 'The clip file was not saved.' })
        continue
      }
      const localFile = path.join(process.cwd(), 'public', clip.src.split('?')[0].replace(/^\//, ''))
      const stored = await storeClip(localFile).catch((error) => {
        console.error('[curator] store', error instanceof Error ? error.message : error)
        return null
      })
      if (!stored && process.env.NODE_ENV === 'production') {
        watch?.dropped.push({ title, from: channel.name, reason: 'The clip could not be stored for playback.' })
        continue
      }
      const base = clipJob.masterCaption ? path.basename(clipJob.masterCaption).split('.')[0] : ''
      const rawTranscript = base
        ? await readFile(path.join(path.dirname(clipJob.masterCaption || ''), `${base}.txt`), 'utf8').catch(() => clip.quote)
        : clip.quote
      const card = await readNameCard(localFile)
      const excerpt = applyCardNames(clip.quote || reading.excerpt, card)
      const transcript = applyCardNames(rawTranscript, card)
      const published = await publishFinding(desk, {
        title,
        url: clip.src.split('?')[0],
        sourceUrl: url,
        domain: 'carrot',
        excerpt,
        summary: reading.summary,
        publisher: channel.name,
        transcript,
        videoBucket: stored?.bucket,
        videoPath: stored?.objectPath
      }).catch((error) => {
        watch?.dropped.push({ title, from: channel.name, reason: error instanceof Error ? error.message : 'The clip could not be posted.' })
        return null
      })
      if (!published) continue
      const home = passes.find((pass) => pass.id === desk.id) || watch
      home?.kept.push({
        title,
        url: clip.src.split('?')[0],
        from: channel.name,
        kind: 'video',
        words: reading.words,
        why: `${desk.name} posts the saved clip.`,
        excerpt: reading.excerpt,
        topicUrl: published.topicUrl
      })
      memory.posted[desk.id] = (memory.posted[desk.id] || 0) + 1
      memory.titles.push(title)
      kept += 1
      console.log(`[curator] kept ${title}`)
    }
  }
}

export function armCurator(): void {
  const holder = globalThis as unknown as { __carrotCurator?: ReturnType<typeof setInterval> }
  if (holder.__carrotCurator) clearInterval(holder.__carrotCurator)
  const pass = () => {
    void runQaMonitor().catch((error) => console.error('[qa] monitor', error instanceof Error ? error.message : error))
    void runCurator({ clipsOnly: true, maxKeep: 1, channels: 2, videosPerChannel: 1 })
      .catch((error) => console.error('[curator] pass failed', error instanceof Error ? error.message : error))
      .finally(() => {
        void runCurator({
          rotate: true,
          maxKeep: 1,
          channels: 1,
          videosPerChannel: 1,
          articles: 1,
          maxDesks: 2,
          skipWatch: true
        }).catch((error) => {
          console.error('[curator] group pass failed', error instanceof Error ? error.message : error)
        })
      })
  }
  void ensureMediaBins()
    .catch((error) => console.error('[curator] media tools', error instanceof Error ? error.message : error))
    .finally(() => {
      if (holder.__carrotCurator) clearInterval(holder.__carrotCurator)
      holder.__carrotCurator = setInterval(pass, 20 * 1000)
      holder.__carrotCurator.unref?.()
      pass()
    })
}
