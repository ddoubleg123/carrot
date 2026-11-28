import { access, mkdir, readFile, writeFile } from 'fs/promises'
import path from 'path'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { findFreeHero } from '@/lib/learn/hero'
import { deskByHandle } from '@/lib/curator/desks'

const DIR = path.join(process.cwd(), 'public', 'group-covers')
const TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
}

type CoverMeta = { cover?: string; source?: string; checkedAt?: string }

function readMeta(entity: unknown): CoverMeta {
  if (!entity || typeof entity !== 'object' || Array.isArray(entity)) return {}
  const row = entity as Record<string, unknown>
  return {
    cover: typeof row.cover === 'string' ? row.cover : undefined,
    source: typeof row.coverSource === 'string' ? row.coverSource : undefined,
    checkedAt: typeof row.coverCheckedAt === 'string' ? row.coverCheckedAt : undefined
  }
}

function localCover(value: string | undefined): boolean {
  return Boolean(value && value.startsWith('/group-covers/') && !value.includes('..'))
}

async function savedPhoto(id: string): Promise<string | null> {
  for (const ext of ['jpg', 'png', 'webp']) {
    try {
      await access(path.join(DIR, `${id}.${ext}`))
      return `/group-covers/${id}.${ext}`
    } catch {
      continue
    }
  }
  return null
}

function xml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char] || char))
}

function hue(title: string): number {
  let hash = 0
  for (const char of title) hash = (hash * 33 + char.charCodeAt(0)) >>> 0
  return hash % 360
}

function posterLines(title: string): string[] {
  const words = title.trim().split(/\s+/).filter(Boolean)
  if (words.length <= 1) return [title.slice(0, 18)]
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (next.length > 14 && line) {
      lines.push(line)
      line = word
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  return lines.slice(0, 3)
}

async function writePoster(id: string, title: string): Promise<string> {
  const color = hue(title)
  const lines = posterLines(title)
  const size = lines.some((line) => line.length > 12) ? 64 : 78
  const start = 320 - ((lines.length - 1) * size) / 2
  const text = lines.map((line, index) => `<text x="320" y="${start + index * size}" text-anchor="middle" dominant-baseline="middle" fill="white" font-family="Segoe UI, sans-serif" font-size="${size}" font-weight="700">${xml(line)}</text>`).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="hsl(${color} 62% 42%)"/>
    <stop offset="1" stop-color="hsl(${(color + 36) % 360} 70% 28%)"/>
  </linearGradient></defs>
  <rect width="640" height="640" fill="url(#g)"/>
  <circle cx="500" cy="120" r="90" fill="white" opacity="0.12"/>
  <circle cx="120" cy="540" r="120" fill="black" opacity="0.12"/>
  ${text}
</svg>`
  await mkdir(DIR, { recursive: true })
  await writeFile(path.join(DIR, `${id}.svg`), svg)
  return `/group-covers/${id}.svg`
}

async function currentPoster(id: string, title: string, current?: string): Promise<string> {
  if (current && localCover(current) && current.endsWith('.svg')) {
    try {
      const text = await readFile(path.join(DIR, path.basename(current)), 'utf8')
      if (text.includes('height="640"')) return current
    } catch { /* rewrite the wide poster the square tile was cropping */ }
  }
  return writePoster(id, title)
}

async function saveBytes(id: string, bytes: Buffer, ext: string): Promise<string> {
  await mkdir(DIR, { recursive: true })
  const name = `${id}.${ext}`
  await writeFile(path.join(DIR, name), bytes)
  return `/group-covers/${name}`
}

async function saveRemotePhoto(id: string, title: string): Promise<string | null> {
  const found = await findFreeHero(title).catch(() => null)
  if (!found?.url) return null
  const response = await fetch(found.url, {
    headers: { Accept: 'image/jpeg,image/png,image/webp', 'User-Agent': 'CarrotLearn/1.0 (group knowledge)' },
    signal: AbortSignal.timeout(8000)
  }).catch(() => null)
  if (!response?.ok) return null
  const mime = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
  const ext = TYPES[mime]
  if (!ext) return null
  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.length < 32 || bytes.length > 4_000_000) return null
  return saveBytes(id, bytes, ext)
}

async function remember(id: string, entity: unknown, cover: string, source: 'photo' | 'poster' | 'member') {
  const base = entity && typeof entity === 'object' && !Array.isArray(entity) ? { ...(entity as Record<string, unknown>) } : {}
  await prisma.patch.update({
    where: { id },
    data: {
      entity: {
        ...base,
        cover,
        coverSource: source,
        coverCheckedAt: new Date().toISOString()
      } as Prisma.JsonObject
    }
  }).catch(() => null)
}

export function knownCover(entity: unknown): string {
  const cover = readMeta(entity).cover
  return localCover(cover) ? cover as string : ''
}

export function portraitCover(handle: string | null | undefined): string {
  return deskByHandle(handle)?.avatar || ''
}

export async function ensureGroupCover(patch: { id: string; title: string; handle?: string; entity: unknown }, options?: { remote?: boolean }): Promise<string> {
  const meta = readMeta(patch.entity)
  if (localCover(meta.cover) && meta.source === 'member') return meta.cover as string
  const portrait = portraitCover(patch.handle)
  if (portrait) return portrait
  const file = await savedPhoto(patch.id)
  if (file) return file
  if (localCover(meta.cover) && meta.source === 'photo') return meta.cover as string
  const recentPoster = meta.source === 'poster' && meta.checkedAt && Date.now() - Date.parse(meta.checkedAt) < 12 * 60 * 60 * 1000
  if (recentPoster && localCover(meta.cover) && meta.cover?.endsWith('.svg')) {
    const poster = await currentPoster(patch.id, patch.title, meta.cover)
    if (poster !== meta.cover) await remember(patch.id, patch.entity, poster, 'poster')
    return poster
  }

  if (options?.remote === false) {
    const poster = await currentPoster(patch.id, patch.title, meta.source === 'poster' ? meta.cover : undefined)
    await remember(patch.id, patch.entity, poster, 'poster')
    return poster
  }

  const photo = await Promise.race([
    saveRemotePhoto(patch.id, patch.title),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 7000))
  ])
  if (photo) {
    await remember(patch.id, patch.entity, photo, 'photo')
    return photo
  }
  const poster = await currentPoster(patch.id, patch.title, meta.source === 'poster' ? meta.cover : undefined)
  await remember(patch.id, patch.entity, poster, 'poster')
  return poster
}

export async function saveGroupCoverFile(id: string, bytes: Buffer, mime: string): Promise<string> {
  const ext = TYPES[mime]
  if (!ext) throw new Error('Use a JPEG, PNG, or WebP image.')
  if (bytes.length < 32 || bytes.length > 2_500_000) throw new Error('That image is empty or larger than 2.5 MB.')
  await mkdir(DIR, { recursive: true })
  const name = `${id}-custom.${ext}`
  await writeFile(path.join(DIR, name), bytes)
  return `/group-covers/${name}`
}
