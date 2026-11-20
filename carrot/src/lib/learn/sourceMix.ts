import { covers } from '@/lib/learn/terms'
import { readPublicUrl, resolveGoogleNews } from '@/lib/learn/publicUrl'

export interface MixHit {
  title: string
  url: string
  quote: string
  image?: string
}

function decode(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (_, n: string) => {
      const code = Number(n)
      return Number.isFinite(code) ? String.fromCharCode(code) : ''
    })
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tag(chunk: string, name: string): string {
  const match = chunk.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'))
  return match ? decode(match[1]) : ''
}

function relevant(title: string, quote: string, tokens: string[]): boolean {
  if (tokens.length === 0) return true
  const hay = `${title} ${quote}`
  const hits = tokens.filter((token) => covers(hay, [token])).length
  if (hits < 1) return false
  return tokens.length <= 5 || hits >= 2
}

async function news(query: string, tokens: string[]): Promise<MixHit[]> {
  const endpoint = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`
  const response = await fetch(endpoint, {
    headers: { 'User-Agent': 'CarrotLearn/1.0 (group knowledge)', Accept: 'application/rss+xml, application/xml, text/xml' },
    signal: AbortSignal.timeout(8000)
  }).catch(() => null)
  if (!response?.ok) return []
  const xml = await response.text()
  const found: MixHit[] = []
  for (const chunk of xml.split(/<item\b/i).slice(1, 8)) {
    const title = tag(chunk, 'title').replace(/\s+-\s+[^-]+$/, '').trim()
    const url = tag(chunk, 'link')
    const quote = tag(chunk, 'description')
    if (!title || !/^https?:\/\//i.test(url) || !relevant(title, quote || title, tokens)) continue
    const publisher = await resolveGoogleNews(url).catch(() => url)
    const page = publisher !== url ? await readPublicUrl(publisher).catch(() => null) : null
    const finalUrl = page?.finalUrl || (publisher !== url ? publisher : url)
    const finalTitle = (page?.title || title).replace(/\s+\|\s+.*$/, '').slice(0, 180)
    const finalQuote = page?.text || quote || title
    found.push({ title: finalTitle, url: finalUrl, quote: finalQuote.slice(0, 4000) })
    if (found.length >= 3) break
  }
  return found
}

async function videos(query: string, tokens: string[]): Promise<MixHit[]> {
  const response = await fetch('https://www.youtube.com/youtubei/v1/search?prettyPrint=false', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
    body: JSON.stringify({
      context: { client: { clientName: 'WEB', clientVersion: '2.20241111.01.00', hl: 'en' } },
      query
    }),
    signal: AbortSignal.timeout(8000)
  }).catch(() => null)
  if (!response?.ok) return []
  const text = await response.text()
  const found: MixHit[] = []
  const seen = new Set<string>()
  for (const match of text.matchAll(/"videoId":"([\w-]{11})"/g)) {
    if (seen.has(match[1])) continue
    seen.add(match[1])
    const nearby = text.slice(match.index || 0, (match.index || 0) + 900)
    const title = nearby.match(/"text":"([^"\\]{12,180})"/)?.[1] || ''
    if (!title || !relevant(title, title, tokens)) continue
    found.push({
      title: title.slice(0, 180),
      url: `https://www.youtube.com/watch?v=${match[1]}`,
      quote: title
    })
    if (found.length >= 2) break
  }
  return found
}

async function photo(query: string, tokens: string[]): Promise<MixHit | null> {
  const search = new URL('https://commons.wikimedia.org/w/api.php')
  search.searchParams.set('action', 'query')
  search.searchParams.set('generator', 'search')
  search.searchParams.set('gsrsearch', `${query} filetype:bitmap`)
  search.searchParams.set('gsrnamespace', '6')
  search.searchParams.set('gsrlimit', '6')
  search.searchParams.set('prop', 'imageinfo')
  search.searchParams.set('iiprop', 'url|mime|extmetadata')
  search.searchParams.set('iiurlwidth', '900')
  search.searchParams.set('format', 'json')
  const response = await fetch(search, {
    headers: { 'User-Agent': 'CarrotLearn/1.0 (group knowledge)', Accept: 'application/json' },
    signal: AbortSignal.timeout(8000)
  }).catch(() => null)
  if (!response?.ok) return null
  const data = await response.json().catch(() => null)
  const pages = data?.query?.pages ? Object.values(data.query.pages) as Array<{
    title?: string
    imageinfo?: Array<{ thumburl?: string; mime?: string; extmetadata?: { ImageDescription?: { value?: string } } }>
  }> : []
  for (const page of pages) {
    const info = page.imageinfo?.[0]
    const image = info?.thumburl || ''
    if (!info?.mime?.startsWith('image/') || !/\.(jpe?g|png|webp)(\?|$)/i.test(image)) continue
    const title = (page.title || '').replace(/^File:/, '').replace(/\.[a-z0-9]+$/i, '').replace(/[_]+/g, ' ')
    const quote = decode(info.extmetadata?.ImageDescription?.value || title)
    if (!relevant(title, quote, tokens)) continue
    const file = encodeURIComponent((page.title || '').replace(/ /g, '_'))
    return {
      title: title.slice(0, 180) || 'Photograph',
      url: `https://commons.wikimedia.org/wiki/${file}`,
      quote: quote.slice(0, 700),
      image: image.split('?')[0]
    }
  }
  return null
}

export async function gatherMix(question: string, tokens: string[]): Promise<MixHit[]> {
  const words = tokens.slice(0, 6).join(' ') || question
  const [articles, criticism, defense, clips, picture] = await Promise.all([
    news(question, tokens).catch(() => []),
    news(`${words} criticism`, tokens).catch(() => []),
    news(`${words} defends OR supports`, tokens).catch(() => []),
    videos(words, tokens).catch(() => []),
    photo(words, tokens).catch(() => null)
  ])
  const pooled = [
    ...articles.slice(0, 2),
    ...criticism.slice(0, 1),
    ...defense.slice(0, 1),
    ...clips.slice(0, 2),
    ...(picture ? [picture] : [])
  ]
  const seen = new Set<string>()
  return pooled.filter((item) => {
    if (seen.has(item.url)) return false
    seen.add(item.url)
    return true
  })
}
