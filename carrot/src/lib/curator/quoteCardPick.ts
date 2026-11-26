/** A rendered quote card, as opposed to the raw article photo. */
export function isFinishedQuote(url?: string | null): boolean {
  const value = String(url || '')
  return value.startsWith('/quote-cards/') || value.includes('quote-cards%2F') || value.includes('/quote-cards/')
}

/** One variation per post, stable, so the feed is not the same layout every time. */
export function pickQuoteCard(urls: string[], key: string): string {
  const ready = urls.filter(isFinishedQuote)
  if (ready.length === 0) return urls[0] || ''
  let hash = 0
  for (const char of key) hash = (Math.imul(hash, 33) + char.charCodeAt(0)) >>> 0
  return ready[hash % ready.length]
}
