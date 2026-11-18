import { spawn } from 'child_process'
import { execFile } from 'child_process'
import { mkdtemp, readdir, readFile, rm } from 'fs/promises'
import os from 'os'
import path from 'path'

export interface FoundItem {
  title: string
  url: string
  when?: string
  blurb?: string
}

function decode(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function tag(chunk: string, name: string): string {
  const match = chunk.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'))
  return match ? decode(match[1]) : ''
}

export function feedItems(xml: string, limit = 8): FoundItem[] {
  const chunks = xml.split(/<entry\b|<item\b/i).slice(1)
  const items: FoundItem[] = []
  for (const chunk of chunks) {
    const video = tag(chunk, 'yt:videoId')
    const linkHref = chunk.match(/<link[^>]+href="([^"]+)"/i)?.[1] || ''
    const link = tag(chunk, 'link') || tag(chunk, 'id')
    const url = video ? `https://www.youtube.com/watch?v=${video}` : (linkHref || link)
    const title = tag(chunk, 'title')
    if (!title || !url.startsWith('http')) continue
    items.push({
      title,
      url,
      when: tag(chunk, 'published') || tag(chunk, 'updated') || tag(chunk, 'pubDate'),
      blurb: tag(chunk, 'summary') || tag(chunk, 'description') || tag(chunk, 'content')
    })
    if (items.length >= limit) break
  }
  return items
}

export async function fetchText(url: string, timeout = 12000): Promise<string | null> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'CarrotLearn/1.0 (curator)', Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.5' },
    signal: AbortSignal.timeout(timeout)
  }).catch(() => null)
  if (!response?.ok) return null
  return response.text()
}

export async function youtubeLatest(handle: string): Promise<FoundItem[]> {
  const binary = await toolPath('yt-dlp')
  if (!binary) return []
  const args = [
    '--flat-playlist',
    '--playlist-end', '4',
    '--no-warnings',
    '--no-update',
    '--print', '%(id)s\t%(title)s',
    `https://www.youtube.com/@${handle}/videos`
  ]
  const child = spawn(binary, args, { windowsHide: true })
  let output = ''
  const timer = setTimeout(() => child.kill(), 30000)
  child.stdout.on('data', (chunk) => {
    output += String(chunk)
  })
  const code: number | null = await new Promise((resolve) => {
    child.on('error', () => resolve(1))
    child.on('close', (status) => resolve(status))
  })
  clearTimeout(timer)
  if (code !== 0) return []
  return output.split(/\r?\n/).flatMap((line) => {
    const [id, title] = line.split('\t')
    if (!id || !title || !/^[\w-]{6,}$/.test(id)) return []
    return [{ title: title.trim(), url: `https://www.youtube.com/watch?v=${id}` }]
  }).slice(0, 4)
}

function toolPath(command: string): Promise<string | null> {
  return new Promise((resolve) => {
    execFile('where.exe', [command], { timeout: 8000, windowsHide: true }, (error, stdout) => {
      if (error) {
        resolve(null)
        return
      }
      resolve(stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean) || null)
    })
  })
}

function captionText(raw: string): string {
  const lines = raw.replace(/^\uFEFF/, '').split(/\r?\n/).flatMap((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed === 'WEBVTT' || trimmed.startsWith('NOTE') || trimmed.startsWith('Kind:') || trimmed.startsWith('Language:')) return []
    if (/^\d+$/.test(trimmed) || trimmed.includes('-->')) return []
    const spoken = trimmed.replace(/<[^>]+>/g, '').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim()
    return spoken.length > 1 ? [spoken] : []
  })
  const unique: string[] = []
  for (const line of lines) {
    if (unique[unique.length - 1] !== line) unique.push(line)
  }
  return unique.join(' ').replace(/\s+/g, ' ').trim().slice(0, 12000)
}

/** Read public captions only. The video file is not downloaded. */
export async function readCaptions(pageUrl: string): Promise<string | null> {
  const binary = await toolPath('yt-dlp')
  if (!binary) return null
  const ffmpeg = await toolPath('ffmpeg')
  const dir = await mkdtemp(path.join(os.tmpdir(), 'carrot-cap-'))
  const env = { ...process.env }
  if (ffmpeg) env.PATH = `${path.dirname(ffmpeg)};${env.PATH || ''}`
  const args = [
    '--skip-download',
    '--no-update',
    '--no-playlist',
    '--no-warnings',
    '--write-sub',
    '--write-auto-sub',
    '--sub-langs', 'en.*,en',
    '--convert-subs', 'vtt',
    '-o', path.join(dir, 'cap.%(ext)s'),
    pageUrl
  ]
  const child = spawn(binary, args, { env, windowsHide: true })
  const timer = setTimeout(() => child.kill(), 45000)
  const code: number | null = await new Promise((resolve) => {
    child.on('error', () => resolve(1))
    child.on('close', (status) => resolve(status))
  })
  clearTimeout(timer)
  try {
    if (code !== 0) return null
    const files = await readdir(dir).catch(() => [] as string[])
    const tracks = files.filter((file) => file.toLowerCase().endsWith('.vtt'))
    let best = ''
    for (const file of tracks) {
      const text = captionText(await readFile(path.join(dir, file), 'utf8').catch(() => ''))
      if (text.length > best.length) best = text
    }
    return best.length >= 40 ? best : null
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined)
  }
}

export async function searchPosts(handle: string): Promise<FoundItem[]> {
  const endpoint = new URL('https://api.fxtwitter.com/2/search')
  endpoint.searchParams.set('q', `from:${handle}`)
  endpoint.searchParams.set('count', '5')
  const response = await fetch(endpoint, {
    headers: { 'User-Agent': 'CarrotLearn/1.0 (curator)', Accept: 'application/json' },
    signal: AbortSignal.timeout(8000)
  }).catch(() => null)
  const data = await response?.json().catch(() => null)
  const rows = Array.isArray(data?.results) ? data.results : []
  return rows.flatMap((row: any) => {
    const text = typeof row?.raw_text === 'string' && row.raw_text.trim() ? row.raw_text : row?.text
    const author = row?.author?.screen_name || handle
    const url = typeof row?.url === 'string' ? row.url : row?.id ? `https://x.com/${author}/status/${row.id}` : ''
    if (!url || typeof text !== 'string' || text.trim().length < 40) return []
    return [{ title: text.replace(/\s+/g, ' ').trim().slice(0, 140), url, blurb: text }]
  }).slice(0, 4)
}

export function linksIn(text: string): string[] {
  return [...text.matchAll(/https?:\/\/[^\s)]+/g)].map((match) => match[0].replace(/[.,]$/, ''))
}
