/**
 * Sources the bots may reuse as a card or a clip.
 * A news page can still be linked. Its photograph and its footage stay off
 * until that outlet is on this list. Fair-use categories are not on the list.
 */
const CLEARED_HOSTS = [
  'congress.gov',
  'senate.gov',
  'house.gov',
  'whitehouse.gov',
  'supremecourt.gov',
  'loc.gov',
  'archives.gov',
  'nasa.gov',
  'cdc.gov',
  'nih.gov',
  'un.org',
  'wikimedia.org',
  'commons.wikimedia.org',
  'upload.wikimedia.org'
]

const LOW_QUALITY_HOSTS = [
  'draftkings.com',
  'fanduel.com',
  'betmgm.com',
  'oddschecker.com',
  'actionnetwork.com'
]

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return ''
  }
}

export function sourceCleared(url: string): boolean {
  const host = hostOf(url)
  if (!host) return false
  if (host.endsWith('.gov') || host.endsWith('.mil') || host.endsWith('.gov.uk')) return true
  return CLEARED_HOSTS.some((item) => host === item || host.endsWith(`.${item}`))
}

export function lowQualitySource(url: string): boolean {
  const host = hostOf(url)
  if (!host) return false
  return LOW_QUALITY_HOSTS.some((item) => host === item || host.endsWith(`.${item}`))
}
