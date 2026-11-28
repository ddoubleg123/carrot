import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { FreeImageAPIs } from '@/lib/content-enrichment/freeImageAPIs'

const HEADERS = {
  'User-Agent': 'CarrotLearn/1.0 (group knowledge)',
  Accept: 'application/json'
}

const SKIP = new Set(['about', 'their', 'there', 'which', 'would', 'could', 'should', 'national', 'association', 'programs', 'program', 'university', 'student', 'college', 'story'])

function tokensOf(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 5 && !SKIP.has(word))
}

function score(text: string, tokens: string[]): number {
  const hay = text.toLowerCase()
  return tokens.reduce((count, token) => count + (hay.includes(token) ? 1 : 0), 0)
}

function relevant(text: string, tokens: string[]): boolean {
  const hay = text.toLowerCase()
  if (tokens.some((token) => token.startsWith('cheer'))) return hay.includes('cheer')
  return score(hay, tokens) > 0
}

function isRaster(url: string): boolean {
  return /\.(jpe?g|png|webp)(\?|$)/i.test(url)
}

export function heroUrlFits(title: string, url: string): boolean {
  if (!url.startsWith('http') || !isRaster(url)) return false
  const name = decodeURIComponent(url.split('?')[0].split('/').pop() || '')
  return relevant(name, tokensOf(title))
}

export async function findFreeHero(title: string): Promise<{ url: string; source: string } | null> {
  const query = title.trim()
  const tokens = tokensOf(query)
  if (!query || tokens.length === 0) return null
  const focus = [...tokens].sort((a, b) => b.length - a.length)[0]
  const commons = await commonsPhoto(query, tokens) || (focus ? await commonsPhoto(focus, tokens) : null)
  if (commons) return { url: commons, source: 'wikimedia' }
  const wiki = await wikiPhoto(query, tokens)
  if (wiki) return { url: wiki, source: 'wikimedia' }
  const free = await Promise.race([
    FreeImageAPIs.searchImages({ query, perPage: 5, orientation: 'landscape' }).catch(() => []),
    new Promise<never[]>((resolve) => setTimeout(() => resolve([]), 5000))
  ])
  const photo = free.find((image) => {
    const url = image.thumbnail || image.url
    return typeof url === 'string' && heroUrlFits(query, url)
  })
  return photo ? { url: photo.thumbnail || photo.url, source: photo.source || 'free' } : null
}

export async function backfillHeroes<T extends { id: string; title: string; hero: unknown; heroRecord?: { imageUrl?: string | null } | null }>(items: T[]) {
  const missing = items.filter((item) => {
    const hero = item.hero && typeof item.hero === 'object'
      ? item.hero as { url?: string; source?: string; checkedAt?: string }
      : null
    const checkedAt = hero?.checkedAt ? Date.parse(hero.checkedAt) : 0
    if (hero?.source === 'none' && Number.isFinite(checkedAt) && Date.now() - checkedAt < 12 * 60 * 60 * 1000) return false
    const url = item.heroRecord?.imageUrl || hero?.url || ''
    return !url || url.startsWith('data:') || !heroUrlFits(item.title, url)
  }).slice(0, 8)
  await Promise.all(missing.map(async (item) => {
    const url = await ensureStoredHero(item.id, item.title, null)
    if (url) item.hero = { url, source: 'free' }
  }))
}

export async function ensureStoredHero(id: string, title: string, current: string | null): Promise<string | null> {
  if (current && heroUrlFits(title, current)) return current
  const found = await findFreeHero(title).catch(() => null)
  const hero = found
    ? { url: found.url, source: found.source, storedAt: new Date().toISOString() }
    : { source: 'none', checkedAt: new Date().toISOString() }
  await prisma.discoveredContent.update({
    where: { id },
    data: { hero: hero as Prisma.JsonObject }
  }).catch(() => null)
  return found?.url || null
}

/** Questions already saved with no picture, or with a file that is not on this machine. */
export async function backfillSearchPhotos(rows: Array<{ id: string; title: string; image: string }>): Promise<Map<string, string>> {
  const missing = rows.filter((row) => !row.image || row.image.startsWith('/curator-thumbs/') || row.image.startsWith('/topic-')).slice(0, 4)
  const found = new Map<string, string>()
  await Promise.all(missing.map(async (row) => {
    const photo = await cardPhoto(row.title).catch(() => null)
    if (!photo) return
    await prisma.$executeRaw`
      UPDATE discovered_content
      SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{image}', to_jsonb(${photo}::text), true)
      WHERE id = ${row.id} AND type = 'topic'
    `.catch(() => null)
    found.set(row.id, photo)
  }))
  return found
}

async function commonsPhoto(query: string, tokens: string[]): Promise<string | null> {
  const search = new URL('https://commons.wikimedia.org/w/api.php')
  search.searchParams.set('action', 'query')
  search.searchParams.set('generator', 'search')
  search.searchParams.set('gsrsearch', `${query} filetype:bitmap`)
  search.searchParams.set('gsrnamespace', '6')
  search.searchParams.set('gsrlimit', '8')
  search.searchParams.set('prop', 'imageinfo')
  search.searchParams.set('iiprop', 'url|mime')
  search.searchParams.set('iiurlwidth', '800')
  search.searchParams.set('format', 'json')
  const data = await readJson(search)
  const pages = data?.query?.pages ? Object.values(data.query.pages) as Array<{ title?: string; imageinfo?: Array<{ thumburl?: string; url?: string; mime?: string }> }> : []
  const ranked = pages
    .map((page) => {
      const info = page.imageinfo?.[0]
      const url = info?.thumburl || info?.url || ''
      const mime = info?.mime || ''
      const label = `${page.title || ''} ${url}`
      return { url, points: score(label, tokens), mime, ok: relevant(label, tokens) }
    })
    .filter((item) => item.ok && item.mime.startsWith('image/') && isRaster(item.url))
    .sort((a, b) => b.points - a.points)
  return ranked[0]?.url || null
}

const GRAPHIC = /moorman|zapruder|autopsy|coffin|funeral|wounded|blood|bomb|attack|corpse|casualty|rubble|missile/i

function nameQuery(question: string): string {
  const skip = new Set(['what', 'when', 'where', 'which', 'who', 'whom', 'whose', 'why', 'how', 'does', 'did', 'was', 'were', 'this', 'that', 'with', 'from', 'about', 'have', 'has', 'had', 'into', 'over', 'after', 'before', 'their', 'there', 'would', 'could', 'should', 'call', 'calls', 'called', 'than', 'then', 'them', 'they', 'your', 'been', 'being', 'will', 'make', 'made', 'also'])
  const words = question.match(/[A-Za-z][A-Za-z0-9'.-]*/g) || []
  return words
    .map((word) => word.replace(/['’]/g, ''))
    .filter((word) => word.length >= 4 && !skip.has(word.toLowerCase()))
    .slice(0, 3)
    .join(' ')
}

export async function cardPhoto(question: string): Promise<string | null> {
  const tokens = tokensOf(question)
  const focus = nameQuery(question)
  if (!focus && tokens.length === 0) return null
  const url = await wikiPhoto(focus || question, tokens.length ? tokens : focus.toLowerCase().split(' '))
  if (!url || !isRaster(url) || GRAPHIC.test(url)) return null
  return url.split('?')[0]
}

export async function questionPhoto(question: string): Promise<string | null> {
  const tokens = tokensOf(question)
  if (tokens.length === 0) return null
  const focus = [...tokens].sort((a, b) => b.length - a.length)[0]
  const candidates = [await wikiPhoto(question, tokens), await commonsPhoto(`${focus} ${tokens.find((token) => token !== focus) || ''}`, tokens)]
  const ranked = candidates
    .filter((url): url is string => typeof url === 'string' && isRaster(url) && !GRAPHIC.test(url))
    .map((url) => ({ url: url.split('?')[0], points: score(decodeURIComponent(url), tokens) + (decodeURIComponent(url).toLowerCase().includes(focus || '') ? 5 : 0) }))
    .sort((a, b) => b.points - a.points)
  return ranked[0]?.url || null
}

export async function pageThumbnail(titles: string[]): Promise<string | null> {
  const unique = [...new Set(titles.map((title) => title.trim()).filter(Boolean))].slice(0, 6)
  if (unique.length === 0) return null
  const search = new URL('https://en.wikipedia.org/w/api.php')
  search.searchParams.set('action', 'query')
  search.searchParams.set('prop', 'pageimages')
  search.searchParams.set('piprop', 'thumbnail')
  search.searchParams.set('pithumbsize', '960')
  search.searchParams.set('titles', unique.join('|'))
  search.searchParams.set('format', 'json')
  search.searchParams.set('formatversion', '2')
  const data = await readJson(search)
  const pages = Array.isArray(data?.query?.pages) ? data.query.pages : []
  const photos = pages
    .map((page: { title?: string; thumbnail?: { source?: string } }) => ({
      title: page.title || '',
      url: (page.thumbnail?.source || '').split('?')[0]
    }))
    .filter((photo: { url: string }) => isRaster(photo.url) && !GRAPHIC.test(photo.url))
  const portrait = photos.find((photo: { title: string; url: string }) => /portrait/i.test(photo.url) || photo.title === 'John F. Kennedy')
  return portrait?.url || photos[0]?.url || null
}

export async function pageThumbnails(titles: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(titles.map((title) => title.trim()).filter(Boolean))].slice(0, 8)
  if (unique.length === 0) return {}
  const search = new URL('https://en.wikipedia.org/w/api.php')
  search.searchParams.set('action', 'query')
  search.searchParams.set('prop', 'pageimages')
  search.searchParams.set('piprop', 'thumbnail')
  search.searchParams.set('pithumbsize', '960')
  search.searchParams.set('titles', unique.join('|'))
  search.searchParams.set('format', 'json')
  search.searchParams.set('formatversion', '2')
  const data = await readJson(search)
  const pages = Array.isArray(data?.query?.pages) ? data.query.pages : []
  const photos: Record<string, string> = {}
  for (const page of pages) {
    const title = typeof page?.title === 'string' ? page.title : ''
    const url = typeof page?.thumbnail?.source === 'string' ? page.thumbnail.source.split('?')[0] : ''
    if (title && isRaster(url) && !GRAPHIC.test(url)) photos[title] = url
  }
  return photos
}

async function wikiPhoto(query: string, tokens: string[]): Promise<string | null> {
  const search = new URL('https://en.wikipedia.org/w/api.php')
  search.searchParams.set('action', 'query')
  search.searchParams.set('generator', 'search')
  search.searchParams.set('gsrsearch', query)
  search.searchParams.set('gsrlimit', '6')
  search.searchParams.set('prop', 'pageimages')
  search.searchParams.set('piprop', 'thumbnail')
  search.searchParams.set('pithumbsize', '800')
  search.searchParams.set('format', 'json')
  const data = await readJson(search)
  const pages = data?.query?.pages ? Object.values(data.query.pages) as Array<{ title?: string; thumbnail?: { source?: string } }> : []
  const ranked = pages
    .map((page) => ({
      url: page.thumbnail?.source || '',
      points: score(`${page.title || ''} ${page.thumbnail?.source || ''}`, tokens),
      ok: relevant(`${page.title || ''} ${page.thumbnail?.source || ''}`, tokens)
    }))
    .filter((item) => item.ok && isRaster(item.url))
    .sort((a, b) => b.points - a.points)
  return ranked[0]?.url || null
}

async function readJson(url: URL): Promise<any | null> {
  const response = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(6000) }).catch(() => null)
  if (!response?.ok) return null
  return response.json().catch(() => null)
}

