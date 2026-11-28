import { decodeEntities } from '@/lib/feedPost'
import { execFile } from 'child_process'
import { createHash } from 'crypto'
import { mkdir, readFile, unlink, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'
import { promisify } from 'util'

const BROWSER = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
const runFile = promisify(execFile)
const FFMPEG = process.env.FFMPEG_PATH || 'C:\\ffmpeg-bin\\ffmpeg-7.1.1-essentials_build\\bin\\ffmpeg.exe'

/** A feed rail is 150px tall, so a multi-megabyte original is wasted weight. */
async function shrinkPreview(buf: Buffer): Promise<Buffer | null> {
  const id = createHash('sha1').update(buf).digest('hex').slice(0, 12)
  const src = path.join(tmpdir(), `carrot-prev-${id}.img`)
  const dest = path.join(tmpdir(), `carrot-prev-${id}.jpg`)
  await writeFile(src, buf)
  try {
    await runFile(FFMPEG, ['-y', '-i', src, '-vf', 'scale=1200:-2', '-q:v', '4', dest])
    const out = await readFile(dest)
    return out.length > 800 ? out : null
  } catch {
    return null
  } finally {
    await unlink(src).catch(() => {})
    await unlink(dest).catch(() => {})
  }
}

export function youtubeThumb(url: string): string | null {
  const id = url.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([\w-]{6,})/)?.[1]
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null
}

function contentImage(html: string, page: string): string {
  const tags = html.match(/<img\b[^>]*>/gi) || []
  for (const tag of tags.slice(0, 16)) {
    const src = tag.match(/\bsrc=["']([^"']+)["']/i)?.[1] || ''
    if (!src || src.startsWith('data:') || /\.svg(?:$|\?)/i.test(src)) continue
    if (/logo|icon|sprite|pixel|avatar|1x1|badge|emoji/i.test(src)) continue
    try {
      const abs = new URL(src, page)
      if (abs.protocol !== 'https:' && abs.protocol !== 'http:') continue
      if (/(^|\.)archive\.org$/i.test(abs.hostname) && /\/static\//i.test(abs.pathname)) continue
      return abs.toString()
    } catch {
      continue
    }
  }
  return ''
}

function originalFromArchive(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (!/(^|\.)web\.archive\.org$/i.test(parsed.hostname)) return null
    const match = parsed.pathname.match(/^\/web\/\d+[a-z_]*\/(https?:\/\/.+)$/i)
    return match?.[1] || null
  } catch {
    return null
  }
}

function metaImage(html: string): string | null {
  const tags = html.match(/<meta\b[^>]*>/gi) || []
  for (const tag of tags) {
    const key = (tag.match(/(?:property|name)=["']([^"']+)["']/i)?.[1] || '').toLowerCase()
    if (key !== 'og:image' && key !== 'twitter:image') continue
    const content = decodeEntities(tag.match(/content=["']([^"']+)["']/i)?.[1] || '')
    if (!content || content.startsWith('data:')) continue
    if (content.startsWith('//')) return `https:${content}`
    return content
  }
  return null
}

function metaContent(html: string, keys: string[]): string {
  const tags = html.match(/<meta\b[^>]*>/gi) || []
  const wanted = new Set(keys.map((key) => key.toLowerCase()))
  for (const tag of tags) {
    const key = (tag.match(/(?:property|name)=["']([^"']+)["']/i)?.[1] || '').toLowerCase()
    if (!wanted.has(key)) continue
    const content = tag.match(/content=["']([^"']+)["']/i)?.[1]
    if (content) return decodeEntities(content).trim()
  }
  return ''
}

function publishedLabel(raw: string): string {
  if (!raw) return ''
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return raw.slice(0, 40)
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export interface LinkCard {
  title: string
  site: string
  published: string
  image: string
}

export async function readLinkCard(url: string): Promise<LinkCard | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': BROWSER, Accept: 'text/html' },
      signal: AbortSignal.timeout(12000),
      redirect: 'follow'
    })
    if (!res.ok) return null
    const full = await res.text()
    const image = metaImage(full) || contentImage(full.slice(0, 400000), url)
    const html = full.slice(0, 250000)
    const title = metaContent(html, ['og:title', 'twitter:title']) || decodeEntities((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').replace(/\s+/g, ' ').trim())
    const site = metaContent(html, ['og:site_name', 'application-name']) || new URL(url).hostname.replace(/^www\./, '')
    const jsonDate = html.match(/"datePublished"\s*:\s*"([^"]+)"/i)?.[1] || html.match(/<time[^>]+datetime=["']([^"']+)["']/i)?.[1] || ''
    const published = publishedLabel(metaContent(html, ['article:published_time', 'og:published_time', 'article:published', 'date', 'sailthru.date', 'pubdate']) || jsonDate)
    const cleanTitle = title.replace(new RegExp(`\\s*[|–—-]\\s*${site.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i'), '').trim()
    return {
      title: cleanTitle.slice(0, 180),
      site,
      published,
      image: image ? new URL(image, url).toString() : ''
    }
  } catch {
    return null
  }
}

function widerThumb(remote: string): string {
  if (!/googleusercontent\.com/i.test(remote)) return remote
  return remote.replace(/=s\d+-w\d+(?:-[a-z0-9]+)?(?=$|[?#])/, '=s0-w800')
}

function googleArticleId(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (!/(^|\.)news\.google\.com$/i.test(parsed.hostname)) return null
    const id = parsed.pathname.split('/').filter(Boolean).pop() || ''
    return /^CB[A-Za-z0-9_-]{20,}$/.test(id) ? id : null
  } catch {
    return null
  }
}

function firstHttp(text: string): string | null {
  const raw = text.match(/https?:\/\/[^"\\\s]+/)?.[0]
  if (!raw) return null
  const found = raw.replace(/\\u0026/g, '&').replace(/\\\//g, '/')
  if (!/^https?:\/\//i.test(found) || /news\.google\.com/i.test(found)) return null
  return found
}

/** Google News article links hide the publisher page. This asks Google for that page. */
async function publisherFromGoogle(url: string): Promise<string | null> {
  const id = googleArticleId(url)
  if (!id) return null
  try {
    const page = await fetch(url, {
      headers: { 'User-Agent': BROWSER, Accept: 'text/html' },
      signal: AbortSignal.timeout(12000),
      redirect: 'follow'
    })
    if (!page.ok) return null
    const html = await page.text()
    const signature = html.match(/data-n-a-sg="([^"]+)"/)?.[1]
    const timestamp = html.match(/data-n-a-ts="([^"]+)"/)?.[1]
    if (!signature || !timestamp) return null
    const inner = ['Fbv4je', JSON.stringify([
      'garturlreq',
      [['X', 'X', ['X', 'X'], null, null, 1, 1, 'US:en', null, 1, null, null, null, null, null, 0, 1], 'X', 'X', 1, [1, 1, 1], 1, 1, null, 0, 0, null, 0],
      id,
      Number(timestamp),
      signature
    ])]
    const res = await fetch('https://news.google.com/_/DotsSplashUi/data/batchexecute?rpcids=Fbv4je', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'User-Agent': BROWSER
      },
      body: 'f.req=' + encodeURIComponent(JSON.stringify([[inner]])),
      signal: AbortSignal.timeout(12000)
    })
    if (!res.ok) return null
    return firstHttp(await res.text())
  } catch {
    return null
  }
}

const NEWS_LOGO_HASH = '134cb2d1ac11911e2232971ad10528df882ce56b'
const NEWS_LOGO_URL = /J6_coFbogxhRI9iM864NL_liGXvsQp2AupsKei7z0cNNfDvGUmWUy20nuUhkREQyrpY4bEeIBuc|gstatic\.com\/gnews\/logo/i

function usableImage(page: string, remote: string): string {
  if (NEWS_LOGO_URL.test(remote)) return ''
  try {
    if (/(^|\.)news\.google\.com$/i.test(new URL(page).hostname)) return ''
  } catch {
    return ''
  }
  return widerThumb(remote)
}

export async function pageImage(url: string): Promise<string | null> {
  const publisher = googleArticleId(url) ? await publisherFromGoogle(url) : null
  const first = publisher || url
  const pages = [first]
  const original = originalFromArchive(first)
  if (original && original !== first) pages.push(original)
  for (const page of pages) {
    const card = await readLinkCard(page)
    const image = card?.image ? usableImage(page, card.image) : ''
    if (image) return image
  }
  return youtubeThumb(url)
}

export async function savedPreview(key: string): Promise<string | null> {
  const base = createHash('sha1').update(key).digest('hex').slice(0, 16)
  const dir = path.join(process.cwd(), 'public', 'curator-thumbs')
  for (const ext of ['jpg', 'png', 'webp']) {
    const file = path.join(dir, `${base}.${ext}`)
    try {
      const buf = await readFile(file)
      if (createHash('sha1').update(buf).digest('hex') === NEWS_LOGO_HASH) {
        await unlink(file).catch(() => {})
        continue
      }
      return `/curator-thumbs/${base}.${ext}`
    } catch {
      /* try the next extension */
    }
  }
  return null
}

/** Save a small preview next to the app so the card and the open view can show it. */
export async function savePreview(remote: string, key: string): Promise<string | null> {
  try {
    if (NEWS_LOGO_URL.test(remote)) return null
    const res = await fetch(remote, {
      headers: {
        'User-Agent': BROWSER,
        Accept: 'image/*',
        Referer: (() => { try { return new URL(remote).origin + '/' } catch { return key } })()
      },
      signal: AbortSignal.timeout(12000),
      redirect: 'follow'
    })
    if (!res.ok || NEWS_LOGO_URL.test(remote)) return null
    const type = (res.headers.get('content-type') || '').toLowerCase()
    if (!type.startsWith('image/')) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 800 || buf.length > 8_000_000) return null
    if (createHash('sha1').update(buf).digest('hex') === NEWS_LOGO_HASH) return null
    const shrunk = buf.length > 400_000 ? await shrinkPreview(buf) : null
    const file = shrunk || (buf.length <= 2_500_000 ? buf : null)
    if (!file) return null
    const ext = shrunk ? 'jpg' : type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg'
    const name = `${createHash('sha1').update(key).digest('hex').slice(0, 16)}.${ext}`
    const dir = path.join(process.cwd(), 'public', 'curator-thumbs')
    await mkdir(dir, { recursive: true })
    await writeFile(path.join(dir, name), file)
    return `/curator-thumbs/${name}`
  } catch {
    return null
  }
}
