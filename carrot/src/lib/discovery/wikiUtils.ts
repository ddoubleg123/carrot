import { canonicalizeUrlFast } from './canonicalize'

function normaliseUrl(candidate: string, source: string): string | null {
  try {
    if (!candidate.startsWith('http')) {
      return new URL(candidate, source).toString()
    }
    return new URL(candidate).toString()
  } catch {
    return null
  }
}

export function extractWikipediaReferences(
  html: string | undefined,
  sourceUrl: string,
  limit = 20
): string[] {
  if (!html) return []
  const referencesMatch = html.match(/<ol[^>]*class="[^"]*references[^"]*"[^>]*>([\s\S]*?)<\/ol>/i)
  if (!referencesMatch) return []

  const refMatches = referencesMatch[1].match(/<li[^>]*>[\s\S]*?<\/li>/gi) || []
  if (!refMatches.length) return []

  const collected: string[] = []
  for (const ref of refMatches) {
    const hrefMatch = ref.match(/href="([^"#]+)"/i)
    if (!hrefMatch) continue
    const normalised = normaliseUrl(hrefMatch[1], sourceUrl)
    if (!normalised) continue
    if (/wikipedia\.org/i.test(normalised)) continue
    const canonical = canonicalizeUrlFast(normalised)
    if (!canonical) continue
    if (collected.includes(canonical)) continue
    collected.push(canonical)
    if (collected.length >= limit) break
  }

  return collected
}

export interface OutgoingLinks {
  offHost: string[]
  sameHost: string[]
}

export function extractOutgoingLinks(
  html: string | undefined,
  sourceUrl: string,
  limit = 20
): OutgoingLinks {
  if (!html) {
    return { offHost: [], sameHost: [] }
  }

  let sourceHost: string | null = null
  try {
    sourceHost = new URL(sourceUrl).hostname.toLowerCase()
  } catch {
    sourceHost = null
  }

  const offHost: string[] = []
  const sameHost: string[] = []
  const anchorRegex = /<a[^>]+href=['"]([^'"#]+)['"][^>]*>/gi
  let match: RegExpExecArray | null

  while ((match = anchorRegex.exec(html))) {
    const direct = normaliseUrl(match[1], sourceUrl)
    if (!direct) continue
    const canonical = canonicalizeUrlFast(direct)
    if (!canonical) continue
    const host = (() => {
      try {
        return new URL(canonical).hostname.toLowerCase()
      } catch {
        return null
      }
    })()
    if (!host) continue
    if (host.includes('wikipedia.org')) continue
    if (host === sourceHost) {
      if (!sameHost.includes(canonical)) {
        sameHost.push(canonical)
      }
    } else if (!offHost.includes(canonical)) {
      offHost.push(canonical)
      if (offHost.length >= limit) break
    }
  }

  return {
    offHost,
    sameHost
  }
}
