import { covers } from '@/lib/learn/terms'

export interface OutsidePage {
  title: string
  url: string
  text: string
}

function abstractText(index: Record<string, number[]> | undefined): string {
  if (!index) return ''
  const words: string[] = []
  for (const [word, positions] of Object.entries(index)) {
    for (const position of positions) words[position] = word
  }
  return words.filter((word) => word.length > 0).join(' ')
}

export async function searchScholarly(question: string, tokens: string[], groupTitle = ''): Promise<OutsidePage[]> {
  const topic = question.trim()
  if (!topic || tokens.length === 0) return []
  const endpoint = new URL('https://api.openalex.org/works')
  endpoint.searchParams.set('search', topic.slice(0, 240))
  endpoint.searchParams.set('per-page', '5')
  const response = await fetch(endpoint, {
    headers: { 'User-Agent': 'CarrotLearn/1.0 (group knowledge)' },
    signal: AbortSignal.timeout(12000)
  }).catch(() => null)
  if (!response?.ok) return []
  const data = await response.json().catch(() => null)
  const works = Array.isArray(data?.results) ? data.results : []
  const found: Array<OutsidePage & { hits: number }> = []
  for (const work of works) {
    const title = typeof work?.display_name === 'string' ? work.display_name.trim() : ''
    const text = abstractText(work?.abstract_inverted_index)
    const url = work?.primary_location?.landing_page_url || work?.doi || work?.id
    if (!title || text.length < 80 || typeof url !== 'string') continue
    const host = (() => { try { return new URL(url).hostname } catch { return '' } })()
    if (/wikipedia|wikimedia|wikidata/i.test(`${host} ${url}`)) continue
    const hay = `${title} ${text}`
    const hits = tokens.filter((token) => covers(hay, [token])).length
    if (hits < Math.min(2, tokens.length)) continue
    if (groupTitle && !covers(hay, [groupTitle])) continue
    if (tokens.includes('jfk') && !/\bjfk\b|john f\.? kennedy|john kennedy/i.test(title)) continue
    found.push({ title, url, text, hits })
  }
  return found
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 2)
    .map(({ title, url, text }) => ({ title, url, text }))
}
