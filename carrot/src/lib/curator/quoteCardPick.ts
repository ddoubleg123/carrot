/** A rendered quote card, as opposed to the raw article photo. */
export function isFinishedQuote(url?: string | null): boolean {
  const value = String(url || '')
  return value.startsWith('/quote-cards/') || value.includes('quote-cards%2F') || value.includes('/quote-cards/')
}

export type QuoteLook = 'editorial' | 'duotone' | 'typeonly' | 'pullquote' | 'backdrop' | 'cinematic' | 'documentary' | 'stat'

const LOOKS: QuoteLook[] = ['editorial', 'duotone', 'typeonly', 'pullquote', 'backdrop']
const FULL_BLEED: QuoteLook[] = ['cinematic', 'documentary']

function mix(key: string): number {
  let hash = 0
  for (const char of key) hash = (Math.imul(hash, 33) + char.charCodeAt(0)) >>> 0
  return hash
}

/** A short figure inside the sentence, the way the stat card uses it. */
export function numberSpan(sentence: string): string {
  const match = sentence.match(/\d[\d,.]*(?:\s*[°%])?(?:\s+[A-Za-z][A-Za-z'-]{1,12}){0,2}/)
  if (!match) return ''
  const bit = match[0].trim()
  return bit.length <= 18 ? bit : ''
}

/**
 * A different layout for each post.
 * A full-bleed frame is only used when the photo is already sharp enough.
 * A small frame is given a layout that keeps the photo small.
 */
export function pickQuoteLook(key: string, sentence: string, sharp = false): { look: QuoteLook; palette: number } {
  const pool = numberSpan(sentence) ? [...LOOKS, 'stat' as const] : [...LOOKS]
  if (sharp) pool.push(...FULL_BLEED)
  const hash = mix(key)
  return { look: pool[hash % pool.length], palette: (hash >>> 8) % 3 }
}

/** One variation per post, stable, so the feed is not the same layout every time. */
export function pickQuoteCard(urls: string[], key: string): string {
  const ready = urls.filter(isFinishedQuote)
  if (ready.length === 0) return urls[0] || ''
  let hash = 0
  for (const char of key) hash = (Math.imul(hash, 33) + char.charCodeAt(0)) >>> 0
  return ready[hash % ready.length]
}

/** The one layout that gets posted. A photograph beats a type-only card. */
const ONE_LAYOUT = ['split', 'arch', 'editorial', 'broadsheet', 'record', 'poster', 'pullquote', 'stat', 'typeonly']

export function oneQuoteCard(urls: string[]): string {
  const ready = urls.filter(isFinishedQuote)
  const pool = ready.length ? ready : urls.filter(Boolean)
  if (pool.length === 0) return ''
  const rank = (url: string) => {
    const name = decodeURIComponent(url)
    const index = ONE_LAYOUT.findIndex((look) => name.includes(`__${look}__`))
    return index === -1 ? ONE_LAYOUT.length : index
  }
  return [...pool].sort((a, b) => rank(a) - rank(b))[0]
}
