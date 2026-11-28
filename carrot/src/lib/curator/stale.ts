const NEWS_MS = 30 * 24 * 60 * 60 * 1000

const MONTHS: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11
}

function valid(year: number, month: number, day: number): Date | null {
  if (year < 1990 || month < 0 || month > 11 || day < 1 || day > 31) return null
  const date = new Date(Date.UTC(year, month, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) return null
  return date
}

/** The date on the page, the feed, or an archive snapshot. No date means we do not guess. */
export function storyDate(parts: { when?: string; url?: string; text?: string }): Date | null {
  const archive = (parts.url || '').match(/\/web\/(\d{4})(\d{2})(\d{2})\d*/)
  if (archive) {
    const dated = valid(Number(archive[1]), Number(archive[2]) - 1, Number(archive[3]))
    if (dated) return dated
  }
  const when = (parts.when || '').trim()
  if (when) {
    const parsed = Date.parse(when)
    if (!Number.isNaN(parsed)) return new Date(parsed)
  }
  const head = (parts.text || '').slice(0, 2500)
  const written = head.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+((?:19|20)\d{2})\b/i)
  if (written) {
    const dated = valid(Number(written[3]), MONTHS[written[1].toLowerCase()], Number(written[2]))
    if (dated) return dated
  }
  const iso = head.match(/\b((?:19|20)\d{2})-(\d{2})-(\d{2})\b/)
  if (iso) return valid(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
  return null
}

/** A current desk does not post a story older than 30 days. A history desk still can. */
export function staleReason(past: boolean, parts: { when?: string; url?: string; text?: string }, now = Date.now()): string | null {
  if (past) return null
  const date = storyDate(parts)
  if (!date) return null
  const age = now - date.getTime()
  if (age <= NEWS_MS) return null
  const label = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
  return `The article is from ${label}. It is not a new story.`
}
