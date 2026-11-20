import { execFile } from 'child_process'
import { mkdir, readFile, writeFile } from 'fs/promises'
import path from 'path'
import type { FoundItem } from '@/lib/curator/read'
import { ytdlpPath } from '@/lib/mediaBins'
import watched from '@/lib/curator/watched-channels.json'

export interface WatchedChannel {
  handle: string
  name: string
  channelId: string
  url: string
  addedAt: string
}

const FILE = path.join(process.cwd(), '.cache', 'curator', 'channels.json')
const LOOKBACK_MS = 3 * 24 * 60 * 60 * 1000

const SEED: WatchedChannel = {
  handle: 'RealCandaceO',
  name: 'Candace Owens',
  channelId: 'UCL0u5uz7KZ9q-pe-VC8TY-w',
  url: 'https://www.youtube.com/@RealCandaceO',
  addedAt: '2026-11-19T20:15:00.000Z'
}


async function save(channels: WatchedChannel[]): Promise<void> {
  await mkdir(path.dirname(FILE), { recursive: true })
  await writeFile(FILE, JSON.stringify(channels, null, 2))
}

function asChannels(value: unknown): WatchedChannel[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const row = item as WatchedChannel
    return row.handle && row.channelId ? [row] : []
  })
}

export async function listChannels(): Promise<WatchedChannel[]> {
  const raw = await readFile(FILE, 'utf8').catch(() => '')
  if (raw) {
    try {
      const parsed = asChannels(JSON.parse(raw))
      if (parsed.length) return parsed
    } catch {
      // The cache file is unreadable. Fall through to the shipped list.
    }
  }
  const seed = asChannels(watched)
  const list = seed.length ? seed : [SEED]
  await save(list)
  return list
}

export function channelFromInput(input: string): { handle: string; url: string } | null {
  const text = input.trim()
  if (!text) return null
  const at = text.match(/youtube\.com\/@([A-Za-z0-9._-]+)/i) || text.match(/^@([A-Za-z0-9._-]+)$/)
  if (at) {
    const handle = at[1]
    return { handle, url: `https://www.youtube.com/@${handle}` }
  }
  const id = text.match(/youtube\.com\/channel\/(UC[\w-]{20,})/i)
  if (id) return { handle: id[1], url: `https://www.youtube.com/channel/${id[1]}` }
  if (/^[A-Za-z0-9._-]{3,}$/.test(text) && !text.includes(' ')) {
    return { handle: text.replace(/^@/, ''), url: `https://www.youtube.com/@${text.replace(/^@/, '')}` }
  }
  return null
}

async function resolveChannel(url: string): Promise<{ channelId: string; name: string; handle: string } | null> {
  const binary = await ytdlpPath()
  if (!binary) return null
  const output = await new Promise<string>((resolve) => {
    execFile(binary, ['--skip-download', '--playlist-items', '1', '--no-warnings', '--no-update', '--print', '%(channel_id)s\t%(channel)s\t%(uploader_id)s', url], { timeout: 40000, windowsHide: true }, (error, stdout) => {
      resolve(error ? '' : String(stdout || ''))
    })
  })
  const [channelId, name, uploader] = output.split(/\r?\n/)[0]?.split('\t') || []
  if (!channelId || !/^UC[\w-]{20,}$/.test(channelId)) return null
  const handle = (uploader || '').replace(/^@/, '') || channelId
  return { channelId, name: (name || handle).trim(), handle }
}

export async function addChannel(input: string): Promise<WatchedChannel> {
  const parsed = channelFromInput(input)
  if (!parsed) throw new Error('Paste a YouTube channel link, like https://www.youtube.com/@RealCandaceO')
  const channels = await listChannels()
  const known = channels.find((item) => item.handle.toLowerCase() === parsed.handle.toLowerCase() || item.url === parsed.url)
  if (known) return known
  const resolved = await resolveChannel(parsed.url)
  if (!resolved) throw new Error('That channel could not be read. Check the link and try again.')
  const duplicate = channels.find((item) => item.channelId === resolved.channelId)
  if (duplicate) return duplicate
  const channel: WatchedChannel = {
    handle: resolved.handle,
    name: resolved.name,
    channelId: resolved.channelId,
    url: parsed.url,
    addedAt: new Date().toISOString()
  }
  await save([channel, ...channels])
  return channel
}

export async function removeChannel(handle: string): Promise<void> {
  const channels = await listChannels()
  await save(channels.filter((item) => item.handle.toLowerCase() !== handle.toLowerCase()))
}

export async function recentUploads(channelId: string): Promise<FoundItem[]> {
  const response = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`, {
    headers: { 'User-Agent': 'CarrotLearn/1.0 (curator)', Accept: 'application/atom+xml, application/xml, text/xml' },
    signal: AbortSignal.timeout(15000)
  }).catch(() => null)
  if (!response?.ok) return []
  const xml = await response.text()
  const cutoff = Date.now() - LOOKBACK_MS
  const items: FoundItem[] = []
  for (const chunk of xml.split(/<entry\b/i).slice(1)) {
    const id = chunk.match(/<yt:videoId>([\w-]{6,})<\/yt:videoId>/i)?.[1]
    const title = chunk.match(/<title>([\s\S]*?)<\/title>/i)?.[1]
      ?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim()
    const published = chunk.match(/<published>([^<]+)<\/published>/i)?.[1]
    if (!id || !title || !published) continue
    const at = Date.parse(published)
    if (Number.isNaN(at) || at < cutoff) continue
    items.push({ title, url: `https://www.youtube.com/watch?v=${id}`, when: published })
  }
  return items
}
