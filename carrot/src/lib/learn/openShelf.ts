import { covers } from '@/lib/learn/terms'
import type { MixHit } from '@/lib/learn/sourceMix'

const HEADERS = {
  'User-Agent': 'CarrotLearn/1.0 (group knowledge)',
  Accept: 'application/json'
}

function plain(value: unknown): string {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function relevant(title: string, quote: string, tokens: string[]): boolean {
  if (tokens.length === 0) return true
  const hay = `${title} ${quote}`
  const hits = tokens.filter((token) => covers(hay, [token])).length
  return tokens.length <= 1 ? hits >= 1 : hits >= 2
}

function wordsOf(tokens: string[], question: string): string {
  return (tokens.slice(0, 6).join(' ') || question).slice(0, 140)
}

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: HEADERS,
    signal: AbortSignal.timeout(8000)
  }).catch(() => null)
  if (!response?.ok) return null
  return response.json().catch(() => null)
}

function fieldText(value: unknown): string {
  if (typeof value === 'string') return plain(value)
  if (Array.isArray(value)) return plain(value.map((item) => fieldText(item)).filter(Boolean).join(' '))
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    if (typeof record['cdata!'] === 'string') return plain(record['cdata!'])
    if (typeof record.value === 'string') return plain(record.value)
  }
  return ''
}

async function excerptFrom(url: string, tokens: string[], title: string): Promise<string> {
  let host = ''
  try {
    host = new URL(url).hostname
  } catch {
    return ''
  }
  if (host !== 'www.gutenberg.org' && host !== 'gutenberg.org' && !host.endsWith('.gutenberg.org')) return ''
  const response = await fetch(url, {
    headers: { 'User-Agent': 'CarrotLearn/1.0 (group knowledge)' },
    signal: AbortSignal.timeout(8000)
  }).catch(() => null)
  if (!response?.ok || !response.body) return ''
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  while (total < 60_000) {
    const step = await reader.read()
    if (step.done || !step.value) break
    chunks.push(step.value)
    total += step.value.length
  }
  await reader.cancel().catch(() => undefined)
  const merged = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.length
  }
  const text = new TextDecoder('utf-8').decode(merged)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const sentences = text.split(/(?<=[.!?])\s+/).map((sentence) => sentence.trim()).filter((sentence) => sentence.length > 40 && sentence.length < 420)
  const ranked = sentences
    .map((sentence, index) => ({
      index,
      hits: tokens.filter((token) => covers(sentence, [token])).length
    }))
    .filter((item) => item.hits > 0)
    .sort((a, b) => b.hits - a.hits || a.index - b.index)
  if (ranked.length) {
    const at = ranked[0].index
    return sentences.slice(at, at + 2).join(' ').slice(0, 700)
  }
  if (!relevant(title, '', tokens)) return ''
  return sentences.slice(0, 2).join(' ').slice(0, 700)
}

async function gutenbergFromArchive(tokens: string[]): Promise<MixHit | null> {
  const terms = tokens.slice(0, 4).map((token) => token.replace(/[^\w.-]/g, '')).filter((token) => token.length >= 3)
  if (!terms.length) return null
  const q = `(${terms.join(' OR ')}) AND collection:gutenberg AND mediatype:texts`
  const endpoint = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}&fl[]=identifier&fl[]=title&fl[]=description&rows=4&page=1&output=json`
  const data = await getJson(endpoint) as {
    response?: { docs?: Array<{ identifier?: string; title?: string | string[]; description?: string | string[] }> }
  } | null
  for (const doc of data?.response?.docs || []) {
    const title = fieldText(doc.title)
    const quote = fieldText(doc.description)
    if (!doc.identifier || !title || quote.length < 40 || !relevant(title, quote, tokens)) continue
    return {
      title: title.slice(0, 180),
      url: `https://archive.org/details/${encodeURIComponent(doc.identifier)}`,
      quote: quote.slice(0, 700)
    }
  }
  return null
}

async function gutenberg(query: string, tokens: string[]): Promise<MixHit | null> {
  const data = await getJson(`https://gutendex.com/books?search=${encodeURIComponent(query)}`) as {
    results?: Array<{ id?: number; title?: string; copyright?: boolean; authors?: Array<{ name?: string }>; formats?: Record<string, string> }>
  } | null
  for (const book of data?.results || []) {
    if (book.copyright !== false || !book.id || !book.title) continue
    const formats = book.formats || {}
    const file = Object.entries(formats).find(([kind, url]) => /text\/plain/i.test(kind) && typeof url === 'string')
      || Object.entries(formats).find(([kind, url]) => /text\/html/i.test(kind) && typeof url === 'string')
    const excerpt = file ? await excerptFrom(file[1], tokens, book.title) : ''
    if (!excerpt || !relevant(book.title, excerpt, tokens)) continue
    const authors = (book.authors || []).map((author) => author.name).filter(Boolean).join(', ')
    return {
      title: book.title.slice(0, 180),
      url: `https://www.gutenberg.org/ebooks/${book.id}`,
      quote: (authors ? `${authors}. ${excerpt}` : excerpt).slice(0, 700)
    }
  }
  return gutenbergFromArchive(tokens)
}

async function archiveBooks(tokens: string[]): Promise<MixHit | null> {
  const terms = tokens.slice(0, 4).map((token) => token.replace(/[^\w.-]/g, '')).filter((token) => token.length >= 3)
  if (!terms.length) return null
  const q = `(${terms.join(' OR ')}) AND mediatype:texts AND rights:publicdomain`
  const endpoint = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}&fl[]=identifier&fl[]=title&fl[]=description&rows=4&page=1&output=json`
  const data = await getJson(endpoint) as {
    response?: { docs?: Array<{ identifier?: string; title?: string | string[]; description?: string | string[] }> }
  } | null
  for (const doc of data?.response?.docs || []) {
    const title = fieldText(doc.title)
    const quote = fieldText(doc.description)
    if (!doc.identifier || !title || quote.length < 40 || !relevant(title, quote, tokens)) continue
    return {
      title: title.slice(0, 180),
      url: `https://archive.org/details/${encodeURIComponent(doc.identifier)}`,
      quote: quote.slice(0, 700)
    }
  }
  return null
}

async function openLibrary(query: string, tokens: string[]): Promise<MixHit | null> {
  const data = await getJson(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=3&fields=key,title,author_name,first_publish_year,first_sentence`) as {
    docs?: Array<{ key?: string; title?: string; author_name?: string[]; first_publish_year?: number; first_sentence?: string[] }>
  } | null
  for (const doc of data?.docs || []) {
    if (!doc.key || !doc.title) continue
    let quote = fieldText(doc.first_sentence)
    if (quote.length < 40) {
      const work = await getJson(`https://openlibrary.org${doc.key}.json`) as { description?: unknown } | null
      quote = fieldText(work?.description)
    }
    if (quote.length < 40 || !relevant(doc.title, quote, tokens)) continue
    const who = (doc.author_name || []).slice(0, 2).join(', ')
    const when = doc.first_publish_year ? `, ${doc.first_publish_year}` : ''
    return {
      title: doc.title.slice(0, 180),
      url: `https://openlibrary.org${doc.key}`,
      quote: `${who ? `${who}${when}. ` : ''}${quote}`.slice(0, 700)
    }
  }
  return null
}

async function nasaImage(query: string, tokens: string[]): Promise<MixHit | null> {
  const data = await getJson(`https://images-api.nasa.gov/search?q=${encodeURIComponent(query)}&media_type=image`) as {
    collection?: {
      items?: Array<{
        data?: Array<{ title?: string; description?: string; description_508?: string; nasa_id?: string }>
        links?: Array<{ href?: string }>
      }>
    }
  } | null
  for (const item of data?.collection?.items || []) {
    const meta = item.data?.[0]
    const title = plain(meta?.title)
    const quote = plain(meta?.description || meta?.description_508)
    if (!meta?.nasa_id || !title || quote.length < 20 || !relevant(title, quote, tokens)) continue
    const image = (item.links || []).map((link) => link.href || '').find((href) => /\.(jpe?g|png|webp)(\?|$)/i.test(href))
    return {
      title: title.slice(0, 180),
      url: `https://images.nasa.gov/details/${encodeURIComponent(meta.nasa_id)}`,
      quote: quote.slice(0, 700),
      image
    }
  }
  return null
}

async function metObject(query: string, tokens: string[]): Promise<MixHit | null> {
  const data = await getJson(`https://collectionapi.metmuseum.org/public/collection/v1.1/search?q=${encodeURIComponent(query)}&hasImages=true&offset=0&limit=6`) as {
    objectIDs?: number[]
  } | null
  for (const id of (data?.objectIDs || []).slice(0, 3)) {
    const object = await getJson(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`) as {
      isPublicDomain?: boolean
      title?: string
      artistDisplayName?: string
      objectDate?: string
      medium?: string
      objectURL?: string
      primaryImageSmall?: string
    } | null
    if (!object?.isPublicDomain || !object.title) continue
    const quote = [object.title, object.artistDisplayName, object.objectDate, object.medium].map((part) => plain(part)).filter(Boolean).join(', ')
    if (!relevant(object.title, quote, tokens)) continue
    const image = object.primaryImageSmall && /^https:\/\//i.test(object.primaryImageSmall) ? object.primaryImageSmall : undefined
    return {
      title: object.title.slice(0, 180),
      url: object.objectURL && /^https:\/\//i.test(object.objectURL) ? object.objectURL : `https://www.metmuseum.org/art/collection/search/${id}`,
      quote: quote.slice(0, 700),
      image
    }
  }
  return null
}

async function worldBank(query: string, tokens: string[]): Promise<MixHit | null> {
  const data = await getJson(`https://search.worldbank.org/api/v2/wds?format=json&qterm=${encodeURIComponent(query)}&rows=3`) as {
    documents?: Record<string, { display_title?: unknown; doctitle?: unknown; title?: unknown; abstracts?: unknown; pdfurl?: unknown; url?: unknown }>
  } | null
  const docs = Object.values(data?.documents || {})
  for (const doc of docs) {
    const title = fieldText(doc.display_title) || fieldText(doc.doctitle) || fieldText(doc.title)
    const quote = fieldText(doc.abstracts)
    const raw = fieldText(doc.pdfurl) || fieldText(doc.url)
    if (!title || quote.length < 40 || !/^https?:\/\//i.test(raw) || !relevant(title, quote, tokens)) continue
    return {
      title: title.slice(0, 180),
      url: raw.replace(/^http:\/\//i, 'https://'),
      quote: quote.slice(0, 700)
    }
  }
  return null
}

export async function searchOpenShelf(question: string, tokens: string[]): Promise<MixHit[]> {
  const query = wordsOf(tokens, question)
  const [book, archive, library, nasa, met, bank] = await Promise.all([
    gutenberg(query, tokens).catch(() => null),
    archiveBooks(tokens).catch(() => null),
    openLibrary(query, tokens).catch(() => null),
    nasaImage(query, tokens).catch(() => null),
    metObject(query, tokens).catch(() => null),
    worldBank(query, tokens).catch(() => null)
  ])
  const pooled = [book, archive, library, nasa, met, bank].filter((item): item is MixHit => Boolean(item))
  const seen = new Set<string>()
  return pooled.filter((item) => {
    if (seen.has(item.url)) return false
    seen.add(item.url)
    return true
  })
}
