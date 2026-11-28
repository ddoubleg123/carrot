import { categoryFor, RAIL, type LivePlatform, type LiveStream, type ShowCategory } from '@/lib/live/streams'

export type RailPresence = 'live' | 'upcoming' | 'offline'

export interface RailItem {
  id: string
  name: string
  platform: LivePlatform
  url: string
  presence: RailPresence
  title: string | null
  playId: string | null
  viewers: number | null
  /** When a show is scheduled and has not started. */
  startsAt: string | null
  /** Still of the current show, or the channel picture when nothing is playing. */
  thumb: string | null
  category: ShowCategory
  /** YouTube channel id, when the row is a YouTube channel. */
  channelId?: string | null
}

const MINUTE = 60 * 1000
const TWITCH_CLIENT = 'kimne78kx3ncx6brgo4mv6wki5h1ko'

let cache: { at: number; items: RailItem[] } | null = null
let quickCache: { at: number; items: RailItem[] } | null = null
let quick: Promise<RailItem[]> | null = null
let full: Promise<RailItem[]> | null = null
let pageItems: RailItem[] | null = null
let pageJob: Promise<void> | null = null

function fresh(entry: { at: number } | null) {
  return !!entry && Date.now() - entry.at < MINUTE
}

/** Names and categories only, so the page can paint before the platform checks finish. */
export function shellRail(): RailItem[] {
  return RAIL.map((show) => offline(show, 'offline'))
}

/** Pass full when the caller can wait. A quick call stays on Twitch and Kick, returns the last result, and does not hold the request open. */
export function railStatus(wait = false): Promise<RailItem[]> {
  if (fresh(cache)) return Promise.resolve(cache!.items)
  if (!wait && fresh(quickCache)) return Promise.resolve(quickCache!.items)
  if (wait) {
    ensureFull()
    return full || quick || Promise.resolve(quickCache?.items || shellRail())
  }
  ensureQuick()
  return Promise.resolve(quickCache?.items || shellRail())
}

export function railPartial(): boolean {
  if (fresh(cache)) return false
  if (quick) return true
  return !fresh(quickCache)
}

/** Live page only. Starts YouTube and Rumble in the background and returns whatever is already known. The request does not stay open for every channel page. */
export function pageRail(): { items: RailItem[]; partial: boolean } {
  if (fresh(cache)) return { items: cache!.items, partial: false }
  ensurePage()
  return { items: pageItems || quickCache?.items || shellRail(), partial: true }
}

/** The first status read, before Twitch or Kick has answered. It is not a finding that anyone went offline. */
export function uncheckedRail(items: RailItem[]): boolean {
  return items.length > 0 && items.every((item) => item.presence === 'offline' && !item.playId)
}

let twitchJob: Promise<RailItem[]> | null = null
let kickJob: Promise<RailItem[]> | null = null

function ensureQuick() {
  if (quick || full || fresh(cache) || fresh(quickCache)) return
  const kickShows = RAIL.filter((show) => show.platform === 'kick')
  const twitchShows = RAIL.filter((show) => show.platform === 'twitch')
  let twitchRows: RailItem[] | null = null
  let kickRows: RailItem[] | null = null
  const publishPart = () => {
    const groups: RailItem[][] = []
    if (twitchRows) groups.push(twitchRows)
    if (kickRows) groups.push(kickRows)
    if (groups.length === 0) return
    quickCache = { at: Date.now(), items: listed(groups) }
  }
  twitchJob = twitchLives(twitchShows).then((rows) => {
    twitchRows = rows
    publishPart()
    return rows
  })
  kickJob = mapPool(kickShows, 8, (show) => kickOne(show)).then((rows) => {
    kickRows = rows
    publishPart()
    return rows
  })
  quick = Promise.all([twitchJob, kickJob]).then(() => quickCache?.items || []).finally(() => {
    if (!full) {
      twitchJob = null
      kickJob = null
    }
    quick = null
  })
}

function ensurePage() {
  if (pageJob || fresh(cache)) return
  ensureQuick()
  const remembered = (platform: LivePlatform) => quickCache?.items.filter((item) => item.platform === platform) || []
  const twitch = twitchJob || Promise.resolve(remembered('twitch'))
  const kick = kickJob || Promise.resolve(remembered('kick'))
  pageJob = (async () => {
    const found = new Map<string, RailItem>()
    const publish = () => {
      pageItems = RAIL.flatMap((show) => {
        const item = found.get(show.id)
        return item ? [item] : []
      })
    }
    const remember = async (job: Promise<RailItem[]>) => {
      const rows = await job.catch(() => [] as RailItem[])
      for (const item of rows) found.set(item.id, item)
      publish()
    }
    const rest = RAIL.filter((show) => show.platform === 'youtube' || show.platform === 'rumble')
    try {
      await Promise.all([
        remember(twitch),
        remember(kick),
        mapPool(rest, 2, async (show) => {
          const item = show.platform === 'youtube' ? await youtubeLive(show) : await rumbleItem(show)
          found.set(show.id, item)
          publish()
          return item
        })
      ])
    } catch {
      // Keep the channels already read. A failed page must not drop the rest.
    }
    cache = { at: Date.now(), items: merge(
      [...found.values()].filter((item) => item.platform === 'twitch'),
      [...found.values()].filter((item) => item.platform === 'kick'),
      [...found.values()].filter((item) => item.platform === 'youtube'),
      [...found.values()].filter((item) => item.platform === 'rumble')
    ) }
    pageItems = cache.items
  })().finally(() => {
    pageJob = null
  })
}

function ensureFull() {
  if (full || (cache && Date.now() - cache.at < MINUTE)) return
  ensureQuick()
  const youtubeShows = RAIL.filter((show) => show.platform === 'youtube')
  const rumbleShows = RAIL.filter((show) => show.platform === 'rumble')
  const remembered = (platform: LivePlatform) => quickCache?.items.filter((item) => item.platform === platform) || []
  const twitch = twitchJob || Promise.resolve(remembered('twitch'))
  const kick = kickJob || Promise.resolve(remembered('kick'))
  full = Promise.all([twitch, kick]).then(async ([twitchRows, kickRows]) => {
    const [youtube, rumble] = await Promise.all([
      mapPool(youtubeShows, 4, (show) => youtubeLive(show)),
      mapPool(rumbleShows, 4, (show) => rumbleItem(show))
    ])
    const items = merge(twitchRows, kickRows, youtube, rumble)
    cache = { at: Date.now(), items }
    return items
  }).finally(() => {
    full = null
    quick = null
    twitchJob = null
    kickJob = null
  })
}

function listed(groups: RailItem[][]): RailItem[] {
  const byId = new Map<string, RailItem>()
  for (const item of groups.flat()) byId.set(item.id, item)
  return RAIL.flatMap((show) => {
    const item = byId.get(show.id)
    return item ? [item] : []
  })
}

function merge(twitch: RailItem[], kick: RailItem[], youtube: RailItem[], rumble: RailItem[]): RailItem[] {
  const byId = new Map<string, RailItem>()
  for (const item of [...twitch, ...kick, ...youtube, ...rumble]) byId.set(item.id, item)
  return RAIL.map((show) => byId.get(show.id) || offline(show, 'offline'))
}

export async function resolveShows(shows: LiveStream[]): Promise<RailItem[]> {
  const accepted = shows.slice(0, 8)
  if (accepted.length === 0) return []
  const picked = {
    twitch: accepted.filter((show) => show.platform === 'twitch'),
    kick: accepted.filter((show) => show.platform === 'kick'),
    youtube: accepted.filter((show) => show.platform === 'youtube'),
    rumble: accepted.filter((show) => show.platform === 'rumble')
  }
  const [twitch, kick, youtube, rumble] = await Promise.all([
    twitchLives(picked.twitch),
    mapPool(picked.kick, 8, (show) => kickOne(show)),
    mapPool(picked.youtube, 8, (show) => youtubeLive(show)),
    mapPool(picked.rumble, 8, (show) => rumbleItem(show))
  ])
  const byId = new Map<string, RailItem>()
  for (const item of [...twitch, ...kick, ...youtube, ...rumble]) byId.set(item.id, item)
  return accepted.map((show) => byId.get(show.id) || offline(show, 'offline'))
}

async function rumbleItem(show: LiveStream): Promise<RailItem> {
  const videoPage = await rumbleVideoPage(show)
  const channelStill = videoPage ? null : await rumbleChannelStill(show)
  if (!videoPage) return offline(show, 'offline', channelStill)
  const embed = await rumbleEmbed(videoPage)
  if (!embed) return offline(show, 'offline', channelStill || await rumbleChannelStill(show))
  const live = await rumbleIsLive(embed.id)
  return {
    id: show.id,
    name: show.name,
    platform: 'rumble',
    url: videoPage,
    presence: live ? 'live' : 'offline',
    title: embed.title || show.name,
    playId: embed.id,
    viewers: null,
    startsAt: null,
    thumb: embed.thumb || channelStill,
    category: categoryFor(show.id)
  }
}

async function rumbleVideoPage(show: LiveStream): Promise<string | null> {
  return show.fallbackVideo || null
}

async function rumbleChannelStill(show: LiveStream): Promise<string | null> {
  const slug = show.url.match(/rumble\.com\/c\/([^/?#]+)/i)?.[1]
  if (!slug) return null
  const page = await readText(`https://streamrecorder.io/rumble/${encodeURIComponent(slug)}`, {}, 4000)
  const id = page?.match(/i\.srcdn\.net\/media\/(\d+)\/thumb_small_270\.jpg/)?.[1]
  if (!id) return null
  return picture(`https://i.srcdn.net/media/${id}/thumb_large.jpg`, ['srcdn.net'])
}

async function rumbleEmbed(videoPage: string): Promise<{ id: string; title: string; thumb: string | null } | null> {
  const page = await readText(`https://rumble.com/api/Media/oembed.json?url=${encodeURIComponent(videoPage)}`, { Accept: 'application/json' }, 8000)
  if (!page) return null
  let data: { html?: string; title?: string; thumbnail_url?: string } | null = null
  try { data = JSON.parse(page) } catch { return null }
  const id = data?.html?.match(/rumble\.com\/embed\/([A-Za-z0-9]+)/)?.[1]
  if (!id) return null
  return { id, title: clip(data?.title), thumb: picture(data?.thumbnail_url, ['rmbl.ws', 'rumble.cloud', 'rumble.com']) }
}

async function rumbleIsLive(embedId: string): Promise<boolean> {
  const page = await readText(`https://rumble.com/embed/${embedId}/`, {}, 8000)
  return !!page && /"live":1/.test(page)
}

async function youtubeLive(show: LiveStream): Promise<RailItem> {
  const page = await readYoutubePage(show.url)
  if (!page) return offline(show, 'offline', await youtubeAvatar(show.url))
  const videoId = youtubeVideoId(page)
  const channelId = youtubeChannelId(show, page)
  const thumb = youtubeStill(page, videoId) || await youtubeAvatar(show.url)
  const title = decodeTitle(page.match(/<meta property="og:title" content="([^"]+)"/)?.[1] || page.match(/<title>([^<]+)<\/title>/)?.[1] || '').replace(/ - YouTube$/, '')
  const scheduled = page.match(/"scheduledStartTime":"(\d+)"/)
  const waiting = /"isUpcoming":true/.test(page) || /LIVE_STREAM_OFFLINE/.test(page)
  if (waiting && scheduled) {
    const at = Number(scheduled[1]) * 1000
    if (Number.isFinite(at) && at > Date.now() + 60_000) {
      return {
        id: show.id,
        name: show.name,
        platform: 'youtube',
        url: videoId ? `https://www.youtube.com/watch?v=${videoId}` : show.url,
        presence: 'upcoming',
        title: title || show.name,
        playId: videoId,
        viewers: null,
        startsAt: new Date(at).toISOString(),
        thumb,
        channelId,
        category: categoryFor(show.id)
      }
    }
    return { ...offline(show, 'offline', thumb), channelId }
  }
  if (!videoId || (!/"isLive":true/.test(page) && !/"isLiveNow":true/.test(page))) return { ...offline(show, 'offline', thumb), channelId }
  return {
    id: show.id,
    name: show.name,
    platform: 'youtube',
    url: `https://www.youtube.com/watch?v=${videoId}`,
    presence: 'live',
    title: title || show.name,
    playId: videoId,
    viewers: null,
    startsAt: null,
    thumb,
    channelId,
    category: categoryFor(show.id)
  }
}

async function twitchLives(shows: LiveStream[]): Promise<RailItem[]> {
  if (shows.length === 0) return []
  const chunks: LiveStream[][] = []
  for (let index = 0; index < shows.length; index += 14) chunks.push(shows.slice(index, index + 14))
  const parts = await Promise.all(chunks.map((chunk) => twitchChunk(chunk)))
  return parts.flat()
}

async function twitchChunk(shows: LiveStream[]): Promise<RailItem[]> {
  const fields = shows.map((show) => {
    const login = loginOf(show.url)
    return `${aliasOf(login)}: user(login: "${login}") { profileImageURL(width: 300) stream { title viewersCount previewImageURL(width: 640, height: 360) game { name } } }`
  }).join(' ')
  const data = await twitchQuery(`{ ${fields} }`)
  return shows.map((show) => {
    const login = loginOf(show.url)
    const user = data?.data?.[aliasOf(login)]
    const stream = user?.stream
    const thumb = picture(stream?.previewImageURL, ['jtvnw.net']) || picture(user?.profileImageURL, ['jtvnw.net'])
    if (!stream) return offline(show, 'offline', thumb)
    return {
      id: show.id,
      name: show.name,
      platform: 'twitch',
      url: show.url,
      presence: 'live',
      title: clip(stream.title) || show.name,
      playId: login,
      viewers: typeof stream.viewersCount === 'number' ? stream.viewersCount : null,
      startsAt: null,
      thumb,
      category: categoryFor(show.id, stream.game?.name)
    }
  })
}

async function kickOne(show: LiveStream): Promise<RailItem> {
    const slug = loginOf(show.url)
    const page = await readText(`https://kick.com/api/v2/channels/${slug}`, { Accept: 'application/json' }, 5000)
    if (!page) return offline(show, 'offline')
    let data: { livestream?: { session_title?: string; viewer_count?: number; thumbnail?: string | { url?: string; src?: string } | null; categories?: KickCategory[] } | null; recent_categories?: KickCategory[]; banner_image?: { url?: string } | null; user?: { profile_pic?: string | null; profilePic?: string | null } } | null = null
    try { data = JSON.parse(page) } catch { return offline(show, 'offline') }
    const rawThumb = data?.livestream?.thumbnail
    const thumb = kickStill(typeof rawThumb === 'string' ? rawThumb : rawThumb?.url || rawThumb?.src)
      || kickStill(data?.banner_image?.url)
      || kickStill(data?.user?.profile_pic || data?.user?.profilePic)
    const recent = data?.recent_categories?.[0]
    if (!data?.livestream) return offline(show, 'offline', thumb, recent?.name, recent?.category?.slug)
    const current = data.livestream.categories?.[0]
    return {
      id: show.id,
      name: show.name,
      platform: 'kick' as const,
      url: show.url,
      presence: 'live' as const,
      title: clip(data.livestream.session_title) || show.name,
      playId: slug,
      viewers: typeof data.livestream.viewer_count === 'number' ? data.livestream.viewer_count : null,
      startsAt: null,
      thumb,
      category: categoryFor(show.id, current?.name, current?.category?.slug)
    }
}

function offline(show: LiveStream, presence: RailPresence, thumb: string | null = null, topic?: string | null, parent?: string | null): RailItem {
  return {
    id: show.id,
    name: show.name,
    platform: show.platform,
    url: show.url,
    presence,
    title: null,
    playId: null,
    viewers: null,
    startsAt: null,
    thumb,
    category: categoryFor(show.id, topic, parent)
  }
}

interface KickCategory {
  name?: string
  category?: { slug?: string }
}

function youtubeChannelId(show: LiveStream, page: string): string | null {
  const fromUrl = show.url.match(/channel\/(UC[\w-]{22})/)
  if (fromUrl) return fromUrl[1]
  const external = page.match(/"externalId":"(UC[\w-]{22})"/)
  if (external) return external[1]
  const browse = page.match(/"browseId":"(UC[\w-]{22})"/)
  return browse?.[1] || null
}

function youtubeVideoId(page: string): string | null {
  const canonical = page.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})"/)
  if (canonical) return canonical[1]
  const live = /"isLive":true/.test(page) || /"isLiveNow":true/.test(page)
  if (!live) return null
  const still = page.match(/rel="image_src" href="https:\/\/i\.ytimg\.com\/vi\/([\w-]{11})\//)
    || page.match(/property="og:image" content="https:\/\/i\.ytimg\.com\/vi\/([\w-]{11})\//)
  return still?.[1] || null
}

async function youtubeAvatar(url: string): Promise<string | null> {
  const body = await readText(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`, { Accept: 'application/json' }, 4000)
  if (!body) return null
  try {
    const data = JSON.parse(body) as { thumbnail_url?: string }
    return data.thumbnail_url ? youtubePicture(data.thumbnail_url) : null
  } catch {
    return null
  }
}

function youtubeStill(page: string, videoId: string | null): string | null {
  const raw = page.match(/rel="image_src" href="(https:\/\/[^"]+)"/)?.[1]
    || page.match(/property="og:image" content="(https:\/\/[^"]+)"/)?.[1]
    || page.match(/content="(https:\/\/[^"]+)" property="og:image"/)?.[1]
  const fromPage = raw ? youtubePicture(raw) : null
  if (fromPage) return fromPage
  const embedded = page.match(/https:\/\/yt3\.(?:googleusercontent|ggpht)\.com\/[A-Za-z0-9_.=/-]+/)
    || page.match(/https:\/\/i\.ytimg\.com\/vi\/[\w-]{11}\/[A-Za-z0-9_]+\.jpg/)
  if (embedded) {
    const found = youtubePicture(embedded[0])
    if (found) return found
  }
  return videoId ? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` : null
}

function youtubePicture(url: string): string | null {
  try {
    const parsed = new URL(url.replace(/\\u0026/g, '&').replace(/&amp;/g, '&'))
    if (parsed.protocol !== 'https:') return null
    if (parsed.hostname === 'i.ytimg.com') {
      const id = parsed.pathname.match(/\/vi\/([\w-]{11})\//)?.[1]
      return id ? `https://i.ytimg.com/vi/${id}/mqdefault.jpg` : null
    }
    if (parsed.hostname === 'yt3.googleusercontent.com' || parsed.hostname === 'yt3.ggpht.com') {
      return parsed.toString().replace(/=s\d+/, '=s480')
    }
  } catch {
    return null
  }
  return null
}

/** Kick's live frame host refuses outside pages. Channel art on files.kick.com does load. */
function kickStill(url: unknown): string | null {
  const picked = picture(url, ['kick.com'])
  if (!picked) return null
  try {
    if (new URL(picked).hostname === 'stream.kick.com') return null
  } catch {
    return null
  }
  return picked
}

function picture(url: unknown, hosts: string[]): string | null {
  if (typeof url !== 'string') return null
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return null
    const ok = hosts.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`))
    return ok ? parsed.toString() : null
  } catch {
    return null
  }
}

function aliasOf(login: string): string {
  return `u_${login.replace(/[^A-Za-z0-9_]/g, '')}`
}

function loginOf(url: string): string {
  const match = url.match(/\/([A-Za-z0-9_]+)\/?$/)
  return (match?.[1] || '').toLowerCase()
}

async function twitchQuery(query: string): Promise<any> {
  try {
    const response = await fetch('https://gql.twitch.tv/gql', {
      method: 'POST',
      headers: { 'Client-ID': TWITCH_CLIENT, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
      cache: 'no-store',
      signal: AbortSignal.timeout(8000)
    })
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const index = next
      next += 1
      results[index] = await fn(items[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()))
  return results
}

/** YouTube's picture sits near the end of the head. Keep that part if the rest of the page is slow. */
async function readYoutubePage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'en-US' },
      cache: 'no-store',
      signal: AbortSignal.timeout(12000)
    })
    if (!response.ok || !response.body) return null
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let text = ''
    try {
      while (text.length < 1_050_000) {
        const chunk = await reader.read()
        if (chunk.done) break
        text += decoder.decode(chunk.value, { stream: true })
        if (text.length > 120_000 && (/"(?:isLive|isLiveNow)":true/.test(text) || /LIVE_STREAM_OFFLINE/.test(text)) && /og:image|image_src/.test(text)) break
      }
    } catch {
      // The picture is already in the head. A slow tail used to discard the whole page.
    } finally {
      await reader.cancel().catch(() => {})
    }
    return text || null
  } catch {
    return null
  }
}

async function readText(url: string, headers: Record<string, string> = {}, timeout = 20000): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'en-US', ...headers },
      cache: 'no-store',
      signal: AbortSignal.timeout(timeout)
    })
    if (!response.ok) return null
    return await response.text()
  } catch {
    return null
  }
}

function decodeTitle(value: string): string {
  return clip(value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>'))
}

function clip(value: unknown): string {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 140)
}
