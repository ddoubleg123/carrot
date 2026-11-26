/** One outlet, one subject lane, and one kind of post. BBC Golf and BBC F1 are the same outlet. */

const SPORT = new Set([
  'sport', 'college-ball', 'nfl-sunday', 'mlb-diamond', 'ncaa-hoops',
  'hockey-ice', 'nba-court', 'golf-links', 'race-day', 'other-sports'
])

export type MixRow = {
  outlet: string
  lane: string
  media: string
}

export function laneOf(bucket?: string | null): string {
  const id = String(bucket || '').trim()
  if (!id) return ''
  return SPORT.has(id) ? 'sport' : id
}

export function outletOf(value?: string | null): string {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw)) return outletHost(raw)
  const site = raw.toLowerCase()
  if (site.includes('bbc')) return 'bbc'
  if (site.includes('washington post') || /\bwapo\b/.test(site)) return 'washington post'
  if (site.includes('new york times') || site.includes('nytimes')) return 'new york times'
  if (site.includes('guardian')) return 'guardian'
  if (site.includes('reuters')) return 'reuters'
  if (site.includes('associated press')) return 'ap'
  if (site.includes('cbs')) return 'cbs'
  if (site.includes('espn')) return 'espn'
  return site.replace(/\s+/g, ' ').slice(0, 40)
}

function outletHost(url: string): string {
  let host = ''
  try {
    host = new URL(url).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return ''
  }
  if (host === 'youtu.be' || host.endsWith('youtube.com')) return ''
  if (host === 'bbc.co.uk' || host.endsWith('.bbc.co.uk') || host === 'bbc.com' || host.endsWith('.bbc.com') || host.endsWith('bbci.co.uk')) return 'bbc'
  if (host.endsWith('washingtonpost.com')) return 'washington post'
  if (host.endsWith('nytimes.com')) return 'new york times'
  if (host.endsWith('theguardian.com')) return 'guardian'
  if (host.endsWith('reuters.com')) return 'reuters'
  if (host.endsWith('apnews.com')) return 'ap'
  if (host.endsWith('cbssports.com') || host.endsWith('cbsnews.com')) return 'cbs'
  if (host.endsWith('espn.com')) return 'espn'
  const parts = host.split('.').filter(Boolean)
  if (parts.length >= 3 && parts[parts.length - 2] === 'co') return parts[parts.length - 3]
  return parts.length >= 2 ? parts[parts.length - 2] : host
}

export function outletFromContent(content?: string | null): string {
  const from = String(content || '').match(/^From:\s*(.+)$/im)
  if (from) return outletOf(from[1])
  const url = String(content || '').match(/https?:\/\/\S+/)
  return url ? outletOf(url[0]) : ''
}

export function mediaOf(post: { content?: string | null; videoUrl?: string | null }): string {
  if (post.videoUrl) return 'video'
  const content = String(post.content || '')
  if (/^kind:\s*quote\b/im.test(content)) return 'card'
  if (/https?:\/\//i.test(content)) return 'article'
  return 'text'
}

/**
 * The last few bot posts. One outlet in that window, two of a subject, three of a kind.
 * Empty means this one can be posted.
 */
export function varietyBlock(recent: MixRow[], next: MixRow): string {
  const window = recent.slice(0, 8)
  if (next.outlet && window.some((row) => row.outlet === next.outlet)) return 'That outlet was just used.'
  if (next.lane && window.filter((row) => row.lane === next.lane).length >= 2) return 'That subject was just used.'
  if (next.media && window.filter((row) => row.media === next.media).length >= 3) return 'The feed already has a run of that kind of post.'
  return ''
}
