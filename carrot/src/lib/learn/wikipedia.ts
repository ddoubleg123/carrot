import { covers } from '@/lib/learn/terms'

const WIKI_API = 'https://en.wikipedia.org/w/api.php'
const HEADERS = {
  'User-Agent': 'CarrotLearn/1.0 (group knowledge)',
  Accept: 'application/json'
}

const SKIP_TITLE = /^(List of|Index of|Glossary of|Outline of|Portal:|Wikipedia:|Help:|File:|Category:|Template:|Book:)/i
const STOP_WORDS = new Set(['what', 'when', 'where', 'which', 'how', 'are', 'was', 'were', 'the', 'and', 'for', 'with', 'from', 'that', 'this', 'about', 'into', 'your', 'does', 'have', 'been', 'will', 'would', 'could', 'should', 'their', 'there', 'they', 'them', 'than', 'then', 'just', 'like', 'more', 'most', 'some', 'such', 'only', 'over', 'also', 'can', 'not', 'but', 'you', 'our'])

function focusTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 3 && !STOP_WORDS.has(word))
}

function matchesFocus(title: string, tokens: string[]): boolean {
  const hay = title.toLowerCase()
  return tokens.some((token) => hay.includes(token) || (token.length > 7 && hay.includes(token.slice(0, 5))))
}
const SKIP_HOST = [
  'wikipedia.org',
  'wikimedia.org',
  'wikidata.org',
  'archive.org',
  'doi.org',
  'worldcat.org',
  'dx.doi.org'
]

export interface WikiArticle {
  title: string
  url: string
  text: string
  thumbnail: string | null
}

export interface WikipediaBundle {
  main: WikiArticle
  related: WikiArticle[]
  references: string[]
}

function wikiUrl(title: string): string {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`
}

async function wikiGet(url: string): Promise<any | null> {
  const response = await fetch(url, {
    headers: HEADERS,
    signal: AbortSignal.timeout(12_000)
  }).catch(() => null)
  if (!response || !response.ok) return null
  return response.json().catch(() => null)
}

function pagesOf(data: any): any[] {
  return Array.isArray(data?.query?.pages) ? data.query.pages : []
}

function articleFromPage(page: any): WikiArticle | null {
  const title = typeof page?.title === 'string' ? page.title : ''
  const text = typeof page?.extract === 'string' ? page.extract.trim() : ''
  if (!title || page?.missing || text.length < 400) return null
  const thumb = page?.thumbnail?.source
  return {
    title,
    url: wikiUrl(title),
    text,
    thumbnail: typeof thumb === 'string' ? thumb : null
  }
}

function snippetText(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

function acronymTitle(title: string, token: string): boolean {
  const words = title.match(/\b[A-Za-z][A-Za-z'-]*/g) || []
  if (words.length < 2 || token.length < 3 || token.length > 6) return false
  const initials = words.map((word) => word[0]).join('').toLowerCase()
  return initials === token || initials.startsWith(token)
}

function pageCovers(title: string, text: string, needed: string[]): boolean {
  if (needed.length === 0) return true
  const hay = `${title} ${text}`
  const hit = needed.filter((token) => covers(hay, [token]) || acronymTitle(title, token))
  const exact = needed.some((token) => title.toLowerCase() === token || acronymTitle(title, token))
  if (exact && hit.length >= 1) return true
  if (!hit.includes(needed[0])) return false
  return needed.length === 1 || hit.length >= 2
}

function titleBoost(title: string, needed: string[]): number {
  const named = needed.filter((token) => token !== 'jfk')
  const lower = title.toLowerCase()
  return named.some((token) => lower === token || acronymTitle(title, token)) ? 12 : 0
}

function hitScore(title: string, snippet: string, group: string | undefined, needed: string[]): number {
  const hay = `${title} ${snippet}`
  const tokenHits = needed.filter((token) => covers(hay, [token]) || acronymTitle(title, token)).length
  const groupHit = group ? covers(hay, [group.toLowerCase()]) : false
  const boost = titleBoost(title, needed)
  if (needed.length > 1 && tokenHits >= 2) {
    return tokenHits * 3 + (groupHit ? 5 : 0) + (covers(hay, needed) ? 4 : 0) + boost
  }
  if (needed.length > 0 && tokenHits === 0) return 0
  if (needed.length > 1 && !groupHit && tokenHits < needed.length) return 0
  if (needed.length > 0 && !groupHit && tokenHits < needed.length) return 0
  return tokenHits * 3 + (groupHit ? 5 : 0) + (needed.length > 0 && covers(hay, needed) ? 4 : 0) + boost
}

async function searchHits(topic: string): Promise<Array<{ title: string; snippet: string }>> {
  const search = new URL(WIKI_API)
  search.searchParams.set('action', 'query')
  search.searchParams.set('list', 'search')
  search.searchParams.set('srsearch', topic)
  search.searchParams.set('srlimit', '8')
  search.searchParams.set('srprop', 'snippet')
  search.searchParams.set('format', 'json')
  const found = await wikiGet(search.toString())
  const hits = Array.isArray(found?.query?.search) ? found.query.search : []
  return hits
    .map((hit: { title?: string; snippet?: string }) => ({
      title: hit.title || '',
      snippet: snippetText(hit.snippet || '')
    }))
    .filter((hit: { title: string }) => hit.title.length > 0 && !SKIP_TITLE.test(hit.title))
}

async function fetchArticle(title: string): Promise<{ article: WikiArticle; page: any } | null> {
  const query = new URL(WIKI_API)
  query.searchParams.set('action', 'query')
  query.searchParams.set('prop', 'extracts|pageimages|extlinks')
  query.searchParams.set('explaintext', '1')
  query.searchParams.set('exlimit', '1')
  query.searchParams.set('ellimit', '20')
  query.searchParams.set('pithumbsize', '400')
  query.searchParams.set('titles', title)
  query.searchParams.set('format', 'json')
  query.searchParams.set('formatversion', '2')
  const data = await wikiGet(query.toString())
  const page = pagesOf(data)[0]
  const article = articleFromPage(page)
  return article ? { article, page } : null
}

function usefulReference(raw: string): string | null {
  const href = raw.startsWith('//') ? `https:${raw}` : raw
  if (!/^https?:\/\//i.test(href)) return null
  try {
    const host = new URL(href).hostname.replace(/^www\./, '').toLowerCase()
    if (SKIP_HOST.some((blocked) => host === blocked || host.endsWith(`.${blocked}`))) return null
    return href
  } catch {
    return null
  }
}

export async function lookupWikipedia(query: string, focus?: string, requireTokens: string[] = [], skipTitles: string[] = []): Promise<WikipediaBundle | null> {
  const topic = query.trim()
  if (!topic) return null
  const tokens = focusTokens(focus || topic)
  const needed = requireTokens.map((token) => token.toLowerCase()).filter((token) => token.length > 1)
  const skipped = new Set(skipTitles.map((title) => title.toLowerCase()))
  if (focus && needed.length > 0) skipped.add(focus.toLowerCase())
  const hits = (await searchHits(topic)).filter((hit) => {
    if (skipped.has(hit.title.toLowerCase())) return false
    if (needed.includes('jfk') && /\brobert\b|ted kennedy|nigel|caroline|edward kennedy/i.test(hit.title)) return false
    return true
  })
  const rankedHits = hits
    .map((hit, index) => ({ ...hit, index, score: hitScore(hit.title, hit.snippet, focus, needed) }))
    .filter((hit) => hit.score > 0 || (needed.length === 0 && matchesFocus(hit.title, tokens)))
    .sort((a, b) => b.score - a.score || a.index - b.index)
  const named = needed.filter((token) => token !== 'jfk')
  const boosted = rankedHits.filter((hit) => titleBoost(hit.title, needed) > 0)
  const pool = boosted.length > 0 ? boosted : rankedHits
  const selectedHits = pool
    .filter((hit, index) => {
      if (index === 0 || !focus) return true
      if (named.some((token) => acronymTitle(hit.title, token) || hit.title.toLowerCase().includes(token))) return true
      return covers(`${hit.title} ${hit.snippet}`, [focus.toLowerCase()])
    })
    .slice(0, 3)
  if (needed.length === 0 && focus && !selectedHits.some((hit) => hit.title.toLowerCase() === focus.toLowerCase())) {
    selectedHits.unshift({ title: focus, snippet: '', index: -1, score: 1 })
  }
  if (selectedHits.length === 0) return null

  const pages: Array<{ article: WikiArticle; page: any }> = []
  for (const hit of selectedHits) {
    const loaded = await fetchArticle(hit.title)
    if (!loaded) continue
    if (needed.length > 0 && !pageCovers(loaded.article.title, loaded.article.text, needed)) continue
    pages.push(loaded)
  }
  const chosen = pages[0]
  if (!chosen) return null
  const mainPage = chosen.page
  const main = chosen.article
  const related = pages.slice(1).map((item) => item.article)

  const references: string[] = []
  for (const link of Array.isArray(mainPage?.extlinks) ? mainPage.extlinks : []) {
    const href = typeof link?.url === 'string' ? link.url : typeof link?.['*'] === 'string' ? link['*'] : ''
    const useful = usefulReference(href)
    if (useful) references.push(useful)
  }

  return {
    main,
    related,
    references: Array.from(new Set(references)).slice(0, 12)
  }
}
