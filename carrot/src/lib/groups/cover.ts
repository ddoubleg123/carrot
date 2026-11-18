import { access, mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { findFreeHero } from '@/lib/learn/hero'

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

async function writePoster(id: string, title: string): Promise<string> {
  const color = hue(title)
  const size = title.length > 22 ? 42 : 56
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="hsl(${color} 62% 42%)"/>
    <stop offset="1" stop-color="hsl(${(color + 36) % 360} 70% 28%)"/>
  </linearGradient></defs>
  <rect width="800" height="500" fill="url(#g)"/>
  <circle cx="640" cy="90" r="120" fill="white" opacity="0.12"/>
  <circle cx="120" cy="420" r="160" fill="black" opacity="0.12"/>
  <text x="56" y="280" fill="white" font-family="Segoe UI, sans-serif" font-size="${size}" font-weight="700">${xml(title.slice(0, 42))}</text>
</svg>`
  await mkdir(DIR, { recursive: true })
  await writeFile(path.join(DIR, `${id}.svg`), svg)
  return `/group-covers/${id}.svg`
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

export async function ensureGroupCover(patch: { id: string; title: string; entity: unknown }, options?: { remote?: boolean }): Promise<string> {
  const meta = readMeta(patch.entity)
  if (localCover(meta.cover) && meta.source === 'member') return meta.cover as string
  const file = await savedPhoto(patch.id)
  if (file) return file
  if (localCover(meta.cover) && meta.source === 'photo') return meta.cover as string
  const recentPoster = meta.source === 'poster' && meta.checkedAt && Date.now() - Date.parse(meta.checkedAt) < 12 * 60 * 60 * 1000
  if (recentPoster && localCover(meta.cover)) return meta.cover as string

  if (options?.remote === false) {
    const poster = localCover(meta.cover) && meta.source === 'poster' ? meta.cover as string : await writePoster(patch.id, patch.title)
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
  const poster = localCover(meta.cover) && meta.source === 'poster' ? meta.cover as string : await writePoster(patch.id, patch.title)
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
