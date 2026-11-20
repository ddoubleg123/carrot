import { decodeEntities } from '@/lib/feedPost'
import { execFile } from 'child_process'
import { createHash } from 'crypto'
import { mkdir, readFile, unlink, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'
import { promisify } from 'util'

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

function metaImage(html: string): string | null {
  const tags = html.match(/<meta\b[^>]*>/gi) || []
  for (const tag of tags) {
    const key = (tag.match(/(?:property|name)=["']([^"']+)["']/i)?.[1] || '').toLowerCase()
    if (key !== 'og:image' && key !== 'twitter:image') continue
    const content = tag.match(/content=["']([^"']+)["']/i)?.[1]
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
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CarrotPreview/1.0)', Accept: 'text/html' },
      signal: AbortSignal.timeout(12000),
      redirect: 'follow'
    })
    if (!res.ok) return null
    const html = (await res.text()).slice(0, 250000)
    const image = metaImage(html)
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

export async function pageImage(url: string): Promise<string | null> {
  const card = await readLinkCard(url)
  return card?.image || null
}

/** Save a small preview next to the app so the card and the open view can show it. */
export async function savePreview(remote: string, key: string): Promise<string | null> {
  try {
    const res = await fetch(remote, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CarrotPreview/1.0)',
        Accept: 'image/*',
        ...(key.startsWith('http') ? { Referer: key } : {})
      },
      signal: AbortSignal.timeout(12000),
      redirect: 'follow'
    })
    if (!res.ok) return null
    const type = (res.headers.get('content-type') || '').toLowerCase()
    if (!type.startsWith('image/')) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 800 || buf.length > 8_000_000) return null
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
