const API = 'https://en.wikipedia.org/w/api.php'
const HEADERS = {
  'User-Agent': 'CarrotHunt/1.0 (citation finder)',
  Accept: 'application/json'
}

const SKIP = [
  'wikipedia.org', 'wikimedia.org', 'wikidata.org',
  'facebook.com', 'instagram.com', 'tiktok.com', 'youtube.com', 'youtu.be',
  'amazon.com', 'google.com', 'reddit.com', 'twitter.com', 'x.com', 'pinterest.com'
]

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return ''
  }
}

function skipped(host: string): boolean {
  return SKIP.some((item) => host === item || host.endsWith(`.${item}`))
}

/** A document the article points at. The article's own wording is not one of these. */
function primary(host: string): boolean {
  return host.endsWith('.gov') || host.endsWith('.mil') || host.endsWith('.gov.uk')
    || host.endsWith('un.org') || host.endsWith('loc.gov') || host.endsWith('archive.org')
    || host.endsWith('congress.gov') || host.endsWith('europa.eu')
}

/** One link per site. Documents from a public record come first. Nothing is dropped for who published it. */
export function rankCitations(urls: string[]): string[] {
  const seen = new Set<string>()
  const kept: string[] = []
  for (const raw of urls) {
    const host = hostOf(raw)
    if (!host || skipped(host) || seen.has(host)) continue
    seen.add(host)
    kept.push(raw)
  }
  return kept.sort((a, b) => Number(primary(hostOf(b))) - Number(primary(hostOf(a)))).slice(0, 8)
}

async function wikiGet(params: Record<string, string>): Promise<any | null> {
  const url = new URL(API)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  url.searchParams.set('format', 'json')
  const response = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(12000) }).catch(() => null)
  if (!response || !response.ok) return null
  return response.json().catch(() => null)
}

/** Pages a Wikipedia article cites. The summary itself is not returned. */
export async function citedPages(topic: string): Promise<string[]> {
  const query = topic.trim()
  if (!query) return []
  const found = await wikiGet({
    action: 'query',
    list: 'search',
    srsearch: query,
    srlimit: '1',
    srprop: ''
  })
  const title = found?.query?.search?.[0]?.title
  if (!title || /^(File|Category|Template|Wikipedia|Help):/i.test(title)) return []
  const page = await wikiGet({
    action: 'query',
    prop: 'extlinks',
    titles: title,
    ellimit: '40',
    formatversion: '2'
  })
  const links = page?.query?.pages?.[0]?.extlinks
  const urls = Array.isArray(links) ? links.map((link: { url?: string }) => link?.url || '') : []
  return rankCitations(urls)
}
