import type { LivePlatform, LiveStream } from '@/lib/live/streams'

export interface ChannelHit {
  platform: LivePlatform
  name: string
  url: string
  thumb: string | null
  handle: string
}

const TWITCH_CLIENT = 'kimne78kx3ncx6brgo4mv6wki5h1ko'

export function isXUrl(raw: string): boolean {
  try {
    const host = new URL(raw.trim()).hostname.replace(/^www\./, '')
    return host === 'x.com' || host === 'twitter.com'
  } catch {
    return false
  }
}

/** A channel page we can resolve. Anything else, including an X link, is ignored. */
export function channelFromUrl(raw: string, name?: string): LiveStream | null {
  let url: URL
  try { url = new URL(raw.trim()) } catch { return null }
  const host = url.hostname.replace(/^www\./, '')
  const parts = url.pathname.split('/').filter(Boolean)
  const label = cleanName(name)
  if ((host === 'youtube.com' || host === 'm.youtube.com') && parts[0]?.startsWith('@')) {
    const handle = parts[0]
    return show('youtube', handle.slice(1), label || handle.slice(1), `https://www.youtube.com/${handle}/live`)
  }
  if ((host === 'youtube.com' || host === 'm.youtube.com') && parts[0] === 'channel' && /^UC[\w-]{22}$/.test(parts[1] || '')) {
    return show('youtube', parts[1], label || parts[1], `https://www.youtube.com/channel/${parts[1]}/live`)
  }
  if (host === 'twitch.tv' && parts[0] && /^[A-Za-z0-9_]{2,30}$/.test(parts[0]) && !['directory', 'videos', 'search', 'settings'].includes(parts[0].toLowerCase())) {
    const login = parts[0].toLowerCase()
    return show('twitch', login, label || login, `https://www.twitch.tv/${login}`)
  }
  if (host === 'kick.com' && parts[0] && /^[A-Za-z0-9_-]{2,40}$/.test(parts[0]) && !['api', 'video', 'browse'].includes(parts[0].toLowerCase())) {
    const slug = parts[0].toLowerCase()
    return show('kick', slug, label || slug, `https://kick.com/${slug}`)
  }
  if (host === 'rumble.com' && parts[0] === 'c' && parts[1] && /^[A-Za-z0-9_-]{2,80}$/.test(parts[1])) {
    return show('rumble', parts[1].toLowerCase(), label || parts[1], `https://rumble.com/c/${parts[1]}`)
  }
  return null
}

export async function searchChannels(query: string): Promise<ChannelHit[]> {
  const q = query.trim().slice(0, 80)
  if (q.length < 2 || isXUrl(q)) return []
  const direct = channelFromUrl(q)
  if (direct) return [{ platform: direct.platform, name: direct.name, url: direct.url, thumb: null, handle: direct.name }]
  if (/^https?:/i.test(q)) return []
  const [youtube, twitch, kick] = await Promise.all([
    youtubeChannels(q),
    twitchChannels(q),
    kickChannels(q)
  ])
  return [...youtube, ...twitch, ...kick].slice(0, 12)
}

async function youtubeChannels(query: string): Promise<ChannelHit[]> {
  try {
    const response = await fetch('https://www.youtube.com/youtubei/v1/search?prettyPrint=false', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
      body: JSON.stringify({
        context: { client: { clientName: 'WEB', clientVersion: '2.20241126.01.00', hl: 'en', gl: 'US' } },
        query,
        params: 'EgIQAg=='
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(12000)
    })
    if (!response.ok) return []
    const data = await response.json()
    const found: ChannelHit[] = []
    walk(data, found, query)
    return found.slice(0, 4)
  } catch {
    return []
  }
}

function walk(node: unknown, out: ChannelHit[], query: string) {
  if (!node || out.length >= 4) return
  if (Array.isArray(node)) {
    node.forEach((child) => walk(child, out, query))
    return
  }
  if (typeof node !== 'object') return
  const row = (node as { channelRenderer?: { channelId?: string; title?: { simpleText?: string; runs?: { text?: string }[] }; thumbnail?: { thumbnails?: { url?: string }[] } } }).channelRenderer
  if (row?.channelId && /^UC[\w-]{22}$/.test(row.channelId)) {
    const name = row.title?.simpleText || row.title?.runs?.[0]?.text || ''
    const thumb = row.thumbnail?.thumbnails?.slice(-1)[0]?.url
    const url = `https://www.youtube.com/channel/${row.channelId}/live`
    if (name && relevant(query, name, row.channelId) && !out.some((hit) => hit.url === url)) {
      out.push({
        platform: 'youtube',
        name: cleanName(name),
        url,
        thumb: httpsPicture(thumb, ['ytimg.com', 'ggpht.com', 'googleusercontent.com']),
        handle: row.channelId
      })
    }
  }
  Object.values(node as Record<string, unknown>).forEach((child) => walk(child, out, query))
}

async function twitchChannels(query: string): Promise<ChannelHit[]> {
  try {
    const response = await fetch('https://gql.twitch.tv/gql', {
      method: 'POST',
      headers: { 'Client-ID': TWITCH_CLIENT, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'query($q: String!) { searchFor(platform: "web", userQuery: $q) { channels { items { login displayName profileImageURL(width: 70) } } } }',
        variables: { q: query }
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(8000)
    })
    if (!response.ok) return []
    const data = await response.json()
    const items = data?.data?.searchFor?.channels?.items
    if (!Array.isArray(items)) return []
    return items.slice(0, 4).flatMap((item: { login?: string; displayName?: string; profileImageURL?: string }) => {
      const login = String(item.login || '')
      const show = channelFromUrl(`https://www.twitch.tv/${login}`, item.displayName)
      if (!show || !relevant(query, show.name, login)) return []
      return [{ platform: 'twitch' as const, name: show.name, url: show.url, thumb: httpsPicture(item.profileImageURL, ['jtvnw.net']), handle: login }]
    })
  } catch {
    return []
  }
}

async function kickChannels(query: string): Promise<ChannelHit[]> {
  try {
    const response = await fetch(`https://kick.com/api/search?searched_word=${encodeURIComponent(query)}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000)
    })
    if (!response.ok) return []
    const data = await response.json()
    const channels = Array.isArray(data?.channels) ? data.channels : []
    return channels.slice(0, 4).flatMap((channel: { slug?: string; is_banned?: boolean; user?: { username?: string; profilePic?: string } }) => {
      if (channel.is_banned) return []
      const show = channelFromUrl(`https://kick.com/${channel.slug || ''}`, channel.user?.username || channel.slug)
      if (!show || !relevant(query, show.name, channel.slug || '')) return []
      return [{ platform: 'kick' as const, name: show.name, url: show.url, thumb: httpsPicture(channel.user?.profilePic, ['kick.com']), handle: show.id }]
    })
  } catch {
    return []
  }
}

function relevant(query: string, name: string, handle: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter((word) => word.length > 1)
  if (words.length === 0) return false
  const parts = `${name} ${handle}`.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
  return words.every((word) => parts.some((part) => part === word || part.startsWith(word)))
}

function show(platform: LivePlatform, key: string, name: string, url: string): LiveStream {
  return { id: `add-${platform}-${key.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 40)}`, name, platform, url }
}

function cleanName(value: unknown): string {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 80)
}

function httpsPicture(url: unknown, hosts: string[]): string | null {
  if (typeof url !== 'string' || !url) return null
  const absolute = url.startsWith('//') ? `https:${url}` : url
  try {
    const parsed = new URL(absolute)
    if (parsed.protocol !== 'https:') return null
    const ok = hosts.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`))
    return ok ? parsed.toString() : null
  } catch {
    return null
  }
}
