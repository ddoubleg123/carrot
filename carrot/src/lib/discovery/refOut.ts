export type RefOutLink = {
  url: string
  title?: string
  sourceHost: string
  pathDepth: number
}

export type RefOutOpts = {
  maxLinks?: number
}

function isHttpUrl(u: string): boolean {
  try {
    const url = new URL(u)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function getPathDepth(inputUrl: string): number {
  try {
    const url = new URL(inputUrl)
    const segments = url.pathname.split('/').filter(Boolean)
    return segments.length
  } catch {
    return 0
  }
}

export function isOffHost(base: string, candidate: string): boolean {
  try {
    const b = new URL(base)
    const c = new URL(candidate, b)
    return c.hostname.toLowerCase() !== b.hostname.toLowerCase()
  } catch {
    return false
  }
}

export function normalizeUrl(u: string, baseUrl?: string): string | null {
  try {
    const resolved = baseUrl ? new URL(u, baseUrl) : new URL(u)
    // Strip UTM-like params
    const stripParams = ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','fbclid','gclid','ref']
    stripParams.forEach((k) => resolved.searchParams.delete(k))
    // Drop fragments
    resolved.hash = ''
    // Unify www
    resolved.hostname = resolved.hostname.replace(/^www\./i, '').toLowerCase()
    // Avoid mobile/amp/print variants in path where obvious
    resolved.pathname = resolved.pathname
      .replace(/\/amp(\/|$)/i, '/')
      .replace(/\/mobile(\/|$)/i, '/')
      .replace(/\/print(\/|$)/i, '/')
      .replace(/\/m\//i, '/')
    return resolved.toString()
  } catch {
    return null
  }
}

function collectLinksByRegex(html: string): Array<{ href: string; title?: string }> {
  const links: Array<{ href: string; title?: string }> = []
  
  // Remove footer, header, and navigation sections that typically contain non-article links
  let cleanedHtml = html
  // Remove footer sections
  cleanedHtml = cleanedHtml.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
  cleanedHtml = cleanedHtml.replace(/<div[^>]*class=["'][^"']*footer[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, '')
  // Remove header/nav sections (but keep main content)
  cleanedHtml = cleanedHtml.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
  cleanedHtml = cleanedHtml.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
  cleanedHtml = cleanedHtml.replace(/<div[^>]*class=["'][^"']*nav[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, '')
  // Remove aside/sidebar sections
  cleanedHtml = cleanedHtml.replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
  
  // Prioritize links in main content areas (article, main, content sections)
  // Also look for common article listing containers
  const mainContentRegex = /<(article|main|section)[^>]*>[\s\S]*?<\/(article|main|section)>/gi
  const mainContentMatches = cleanedHtml.match(mainContentRegex)
  
  // Also look for common article listing patterns (divs with article-related classes)
  const articleListRegex = /<div[^>]*class=["'][^"']*(?:article|story|post|news|content|listing|feed|stream|grid|list)[^"']*["'][^>]*>[\s\S]*?<\/div>/gi
  const articleListMatches = cleanedHtml.match(articleListRegex)
  
  // Combine main content and article listing areas
  const contentAreas = []
  if (mainContentMatches) contentAreas.push(...mainContentMatches)
  if (articleListMatches) contentAreas.push(...articleListMatches)
  
  // Use content areas if found, otherwise fall back to cleaned HTML
  const contentToSearch = contentAreas.length > 0 ? contentAreas.join('\n') : cleanedHtml
  
  // Simple anchor tag extraction; robust libraries can be swapped in later
  const anchorRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi
  let m: RegExpExecArray | null
  while ((m = anchorRegex.exec(contentToSearch)) !== null) {
    const href = m[1]
    const inner = m[2]?.replace(/<[^>]+>/g, '').trim()
    links.push({ href, title: inner || undefined })
    if (links.length > 2000) break
  }
  return links
}

function isWikipedia(url: string): boolean {
  try {
    const u = new URL(url)
    return u.hostname.toLowerCase().endsWith('wikipedia.org')
  } catch {
    return false
  }
}

function prioritizeWikipediaRefs(html: string): string[] {
  const refs: string[] = []
  // Collect links inside common reference areas
  const blocks: string[] = []
  const refsOl = html.match(/<ol[^>]+class=["'][^"']*references[^"']*["'][^>]*>[\s\S]*?<\/ol>/i)
  if (refsOl) blocks.push(refsOl[0])
  const refsH2 = html.match(/<h2[^>]*>\s*References\s*<\/h2>[\s\S]*?(?:<h2|$)/i)
  if (refsH2) blocks.push(refsH2[0])
  const candidates = blocks.length ? blocks.join('\n') : html
  const links = collectLinksByRegex(candidates)
  for (const l of links) {
    refs.push(l.href)
    if (refs.length > 500) break
  }
  return refs
}

export async function extractOffHostLinks(
  html: string,
  baseUrl: string,
  opts: RefOutOpts = {}
): Promise<RefOutLink[]> {
  const maxLinks = typeof opts.maxLinks === 'number' ? Math.max(1, opts.maxLinks) : 20
  const rawLinks = isWikipedia(baseUrl) ? prioritizeWikipediaRefs(html) : collectLinksByRegex(html).map(l => l.href)
  const results: RefOutLink[] = []
  const seen = new Set<string>()

  for (const candidate of rawLinks) {
    if (!candidate) continue
    if (candidate.startsWith('#')) continue
    if (/^(mailto:|javascript:)/i.test(candidate)) continue
    const normalized = normalizeUrl(candidate, baseUrl)
    if (!normalized) continue
    if (!isHttpUrl(normalized)) continue
    if (!isOffHost(baseUrl, normalized)) continue
    if (seen.has(normalized)) continue
    seen.add(normalized)
    try {
      const u = new URL(normalized)
      results.push({
        url: normalized,
        title: undefined,
        sourceHost: u.hostname.toLowerCase(),
        pathDepth: getPathDepth(normalized)
      })
    } catch {
      // skip
    }
    if (results.length >= maxLinks) break
  }
  return results
}


