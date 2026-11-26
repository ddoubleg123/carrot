import { spawn } from 'child_process'
import { mkdtemp, readdir, readFile, rm } from 'fs/promises'
import os from 'os'
import path from 'path'
import { ffmpegPath, ytdlpPath } from '@/lib/mediaBins'

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
  const binary = await ytdlpPath()
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
  const binary = await ytdlpPath()
  if (!binary) return null
  const ffmpeg = await ffmpegPath()
  const dir = await mkdtemp(path.join(os.tmpdir(), 'carrot-cap-'))
  const env = { ...process.env }
  if (ffmpeg) env.PATH = `${path.dirname(ffmpeg)}${path.delimiter}${env.PATH || ''}`
  const args = [
    '--skip-download',
    '--no-update',
    '--no-playlist',
    '--no-warnings',
    '--write-sub',
    '--write-auto-sub',
    '--sub-langs', 'en-orig,en,en-US,en-GB',
    '--convert-subs', 'vtt',
    '-o', path.join(dir, 'cap.%(ext)s'),
    pageUrl
  ]
  const child = spawn(binary, args, { env, windowsHide: true })
  const timer = setTimeout(() => child.kill(), 45000)
  await new Promise((resolve) => {
    child.on('error', () => resolve(1))
    child.on('close', (status) => resolve(status))
  })
  clearTimeout(timer)
  try {
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

export function fillQuery(ref: string, term: string): string {
  return ref.replaceAll('{q}', encodeURIComponent(term.slice(0, 80)))
}

export function alternateFeed(html: string, base: string): string | null {
  const tags = html.match(/<link\b[^>]*>/gi) || []
  for (const tag of tags) {
    if (!/alternate/i.test(tag) || !/rss|atom|xml/i.test(tag)) continue
    const href = tag.match(/href=["']([^"']+)["']/i)?.[1]
    if (!href) continue
    try {
      return new URL(href, base).href
    } catch {
      continue
    }
  }
  return null
}

const SKIP_LINK = /(^|\.)(facebook|instagram|tiktok|youtube|youtu|twitter|x|pinterest|amazon|google|reddit|apple|spotify)\./i
const SKIP_PATH = /\/(login|signup|sign-in|account|privacy|terms|wp-admin|wp-login|cart|tag|category|author|about|contact|search)(\/|$)/i

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return ''
  }
}

function cleanLabel(value: string): string {
  return value
    .replace(/\\u([\dA-Fa-f]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\n|\\t|\\\//g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Pull readable pages out of a site or a public record. The record's own address is not one of them. */
export function listedPages(body: string, base: string, limit = 8): FoundItem[] {
  const fed = /<(rss|feed|item|entry)\b/i.test(body) ? feedItems(body, limit) : []
  if (fed.length) return fed
  const found: FoundItem[] = []
  const seen = new Set<string>()
  const push = (title: string, raw: string) => {
    const label = cleanLabel(title)
    if (label.length < 8 || found.length >= limit) return
    let abs = raw.replace(/\\\//g, '/')
    try {
      abs = new URL(abs, base).href.split('#')[0]
    } catch {
      return
    }
    if (!abs.startsWith('http') || abs === base || seen.has(abs)) return
    const host = hostOf(abs)
    if (!host || SKIP_LINK.test(host) || SKIP_PATH.test(abs)) return
    seen.add(abs)
    found.push({ title: label.slice(0, 180), url: abs })
  }
  const json = body.trim().startsWith('{') || body.trim().startsWith('[')
  if (json) {
    const pair = /"(?:title|name|headline)"\s*:\s*"((?:\\.|[^"\\]){8,220})"[\s\S]{0,500}?"(?:url|link|html_url|uri)"\s*:\s*"(https?:[^"]+)"/gi
    for (const match of body.matchAll(pair)) push(match[1], match[2])
    const flipped = /"(?:url|link|html_url|uri)"\s*:\s*"(https?:[^"]+)"[\s\S]{0,500}?"(?:title|name|headline)"\s*:\s*"((?:\\.|[^"\\]){8,220})"/gi
    for (const match of body.matchAll(flipped)) push(match[2], match[1])
  } else {
    const anchor = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]{0,240}?)<\/a>/gi
    for (const match of body.matchAll(anchor)) push(match[2], match[1])
    const baseHost = hostOf(base)
    const same = found.filter((item) => hostOf(item.url) === baseHost)
    if (same.length) return same.slice(0, limit)
  }
  return found.slice(0, limit)
}

export async function itemsFrom(kind: 'rss' | 'site' | 'query' | 'x' | 'youtube', ref: string, limit = 8): Promise<FoundItem[]> {
  if (kind === 'x') {
    const posts = await searchPosts(ref.replace(/^@/, ''))
    return posts.flatMap((post) => {
      const outbound = linksIn(post.blurb || '').find((link) => !/x\.com|twitter\.com|t\.co/.test(link))
      return outbound ? [{ title: post.title, url: outbound, blurb: post.blurb }] : []
    })
  }
  if (kind === 'youtube') return []
  if (kind === 'rss') {
    const xml = await fetchText(ref)
    return xml ? feedItems(xml, limit) : []
  }
  const body = await fetchText(ref)
  if (!body) return []
  if (kind === 'site') {
    const feed = alternateFeed(body, ref)
    if (feed) {
      const xml = await fetchText(feed)
      const items = xml ? feedItems(xml, limit) : []
      if (items.length) return items
    }
  }
  const listed = listedPages(body, ref, limit)
  if (listed.length) return listed
  return kind === 'site' ? [{ title: '', url: ref }] : []
}
