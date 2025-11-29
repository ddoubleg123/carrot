export function getPathDepth(inputUrl: string): number {
  try {
    const url = new URL(inputUrl)
    const segments = url.pathname.split('/').filter(Boolean)
    return segments.length
  } catch {
    return 0
  }
}

export function isLikelyDeepLink(inputUrl: string): boolean {
  const depth = getPathDepth(inputUrl)
  if (/\.(pdf)$/i.test(inputUrl)) return true
  if (depth >= 2) return true
  if (/(\/news\/|\/article\/|\/story\/|\/sports\/|\/politics\/|\/business\/|\/tech\/|\/investigations\/|\/opinion\/)/i.test(inputUrl)) {
    return true
  }
  return false
}

export function hostIsOfficial(host: string): boolean {
  const h = host.toLowerCase()
  return (
    h.endsWith('.gov') ||
    h.endsWith('.mil') ||
    h.endsWith('.int') ||
    h.endsWith('.un.org') ||
    h.endsWith('.who.int') ||
    h.includes('.court') ||
    h.includes('.sec.gov') ||
    h.includes('.ecj.europa.eu')
  )
}

export function passesDeepLinkFilters(
  inputUrl: string,
  host: string,
  publishDateGuess?: Date
): boolean {
  // Reject wiki hosts outright
  if (host.endsWith('wikipedia.org') || host.endsWith('m.wikipedia.org')) {
    return false
  }
  
  // Reject privacy, support, cookie, tools, and other non-content pages
  const lowerUrl = inputUrl.toLowerCase()
  const rejectPatterns = [
    /\/privacy/i,
    /\/support\//i,
    /\/cookies?/i,
    /\/cookie/i,
    /\/tools\//i,
    /\/legal\//i,
    /\/terms/i,
    /\/about\//i,
    /\/contact\//i,
    /\/help\//i,
    /\/faq/i,
    /\/sitemap/i,
    /\/feed/i,
    /\/rss/i,
    /privacy\./i,  // privacy.example.com
    /support\./i,  // support.example.com
    /tools\./i,    // tools.example.com
    /cookiedatabase/i,
    /gaoptout/i,
    /opt.?out/i
  ]
  if (rejectPatterns.some(pattern => pattern.test(lowerUrl))) {
    return false
  }
  
  // Reject common footer/header domains
  const rejectHosts = [
    'cookiedatabase.org',
    'tools.google.com',
    'support.apple.com',
    'support.mozilla.org',
    'support.microsoft.com',
    'nbcuniversalprivacy.com',
    'facebook.com'
  ]
  if (rejectHosts.some(rejectHost => host.includes(rejectHost))) {
    return false
  }
  
  if (!isLikelyDeepLink(inputUrl)) {
    return false
  }
  
  // Prioritize article-like URLs (those with dates, article slugs, etc.)
  const articlePatterns = [
    /\d{4}\/\d{2}\/\d{2}/,  // Date in URL: 2024/11/29
    /\d{4}-\d{2}-\d{2}/,    // Date in URL: 2024-11-29
    /\/article\//i,
    /\/story\//i,
    /\/post\//i,
    /\/news\//i,
    /\/sports\//i,
    /\/[a-z0-9-]{15,}/i     // Long slug (likely article) - reduced from 20 to 15
  ]
  const isArticleLike = articlePatterns.some(pattern => pattern.test(inputUrl))
  
  // If it's not article-like and has very low path depth, likely a listing/nav page
  // But be more lenient - allow depth 1 if it looks like an article
  const depth = getPathDepth(inputUrl)
  if (!isArticleLike && depth < 1) {
    return false
  }
  
  // Allow more URLs through - if it passes the reject patterns and has some depth, it's probably OK
  // The vetter will filter out non-article content later
  
  if (publishDateGuess && !hostIsOfficial(host)) {
    const twentyFourMonthsAgo = new Date()
    twentyFourMonthsAgo.setMonth(twentyFourMonthsAgo.getMonth() - 24)
    if (publishDateGuess < twentyFourMonthsAgo) {
      return false
    }
  }
  return true
}


