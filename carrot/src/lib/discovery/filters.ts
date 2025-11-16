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
  if (!isLikelyDeepLink(inputUrl)) {
    return false
  }
  if (publishDateGuess && !hostIsOfficial(host)) {
    const twentyFourMonthsAgo = new Date()
    twentyFourMonthsAgo.setMonth(twentyFourMonthsAgo.getMonth() - 24)
    if (publishDateGuess < twentyFourMonthsAgo) {
      return false
    }
  }
  return true
}


