export type Official = {
  id: string
  name: string
  office: string
  party: string
  state: string
  level: 'federal' | 'state'
  handle?: string
  zip?: string
  place?: string
  phone?: string
  email?: string
  website?: string
  contactForm?: string
  address?: string
  offices?: OfficeLine[]
  staff?: StaffLine[]
  staffChecked?: boolean
  photo?: string
  username?: string
}

export type OfficeLine = {
  city: string
  phone: string
  address: string
}

export type StaffLine = {
  name: string
  role: string
  email: string
  phone: string
}

export type SocialPost = {
  text: string
  url: string
}

export type Story = {
  title: string
  url: string
  source: string
}

export type FeedItem = {
  id: string
  personId: string
  personName: string
  kind: 'bill' | 'hearing' | 'news' | 'post' | 'mention'
  title: string
  detail: string
  url: string
  source: string
  at: string
}

const FIPS: Record<string, string> = {
  '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA', '08': 'CO', '09': 'CT', '10': 'DE',
  '11': 'DC', '12': 'FL', '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL', '18': 'IN', '19': 'IA',
  '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME', '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN',
  '28': 'MS', '29': 'MO', '30': 'MT', '31': 'NE', '32': 'NV', '33': 'NH', '34': 'NJ', '35': 'NM',
  '36': 'NY', '37': 'NC', '38': 'ND', '39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI',
  '45': 'SC', '46': 'SD', '47': 'TN', '48': 'TX', '49': 'UT', '50': 'VT', '51': 'VA', '53': 'WA',
  '54': 'WV', '55': 'WI', '56': 'WY'
}

type Term = {
  type?: string
  state?: string
  district?: number
  party?: string
  end?: string
  phone?: string
  url?: string
  contact_form?: string
  address?: string
}
type Legislator = { id?: { bioguide?: string }; name?: { official_full?: string; first?: string; last?: string }; terms?: Term[] }

let roster: { at: number; people: Legislator[] } | null = null
let handles: Map<string, string> | null = null
let governorText: { at: number; wiki: string } | null = null
const lineups = new Map<string, { at: number; place: string; people: Official[] }>()
const storyCache = new Map<string, { at: number; stories: Story[] }>()
const postCache = new Map<string, { at: number; posts: SocialPost[] }>()

async function readJson(url: string) {
  const response = await fetch(url, { headers: { 'User-Agent': 'Carrot/1.0' }, signal: AbortSignal.timeout(20000) })
  if (!response.ok) throw new Error(String(response.status))
  return response.json()
}

async function legislators(): Promise<Legislator[]> {
  if (roster && Date.now() - roster.at < 12 * 60 * 60 * 1000) return roster.people
  const people = await readJson('https://unitedstates.github.io/congress-legislators/legislators-current.json') as Legislator[]
  roster = { at: Date.now(), people: Array.isArray(people) ? people : [] }
  return roster.people
}

function serving(person: Legislator): Term | null {
  const term = person.terms?.[person.terms.length - 1]
  if (!term?.end || new Date(term.end).getTime() < Date.now()) return null
  return term
}

function fullName(person: Legislator): string {
  return person.name?.official_full || [person.name?.first, person.name?.last].filter(Boolean).join(' ')
}

function houseMember(people: Legislator[], state: string, district: number): Official | null {
  for (const person of people) {
    const term = serving(person)
    if (!term || term.type !== 'rep' || term.state !== state || Number(term.district) !== district) continue
    return {
      id: person.id?.bioguide || `${state}-house-${district}`,
      name: fullName(person),
      office: `U.S. House, district ${district}`,
      party: term.party || '',
      state,
      level: 'federal',
      phone: term.phone || '',
      website: term.url || '',
      contactForm: term.contact_form || '',
      address: term.address || ''
    }
  }
  return null
}

function senators(people: Legislator[], state: string): Official[] {
  const found: Official[] = []
  for (const person of people) {
    const term = serving(person)
    if (!term || term.type !== 'sen' || term.state !== state) continue
    found.push({
      id: person.id?.bioguide || `${state}-senate-${found.length}`,
      name: fullName(person),
      office: 'U.S. Senate',
      party: term.party || '',
      state,
      level: 'federal',
      phone: term.phone || '',
      website: term.url || '',
      contactForm: term.contact_form || '',
      address: term.address || ''
    })
  }
  return found
}

async function wikiExtract(title: string): Promise<string> {
  const response = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, {
    headers: { 'User-Agent': 'Carrot/1.0' },
    signal: AbortSignal.timeout(8000)
  })
  if (!response.ok) return ''
  const data = await response.json().catch(() => null)
  return typeof data?.extract === 'string' ? data.extract : ''
}

function ordinal(value: number): string {
  const tail = value % 100
  if (tail >= 11 && tail <= 13) return `${value}th`
  if (value % 10 === 1) return `${value}st`
  if (value % 10 === 2) return `${value}nd`
  if (value % 10 === 3) return `${value}rd`
  return `${value}th`
}

function representedBy(extract: string): string {
  const match = extract.match(/represented by ([A-Z][^,.]{2,50}?) since/)
  return match ? match[1].trim() : ''
}

async function stateOfficial(id: string, office: string, state: string, pages: string[]): Promise<Official | null> {
  for (const page of pages) {
    const name = representedBy(await wikiExtract(page).catch(() => ''))
    if (name && name.length <= 60) return { id, name, office, party: '', state, level: 'state' }
  }
  return null
}

async function governorOf(stateName: string, state: string): Promise<Official | null> {
  if (!governorText || Date.now() - governorText.at > 12 * 60 * 60 * 1000) {
    const response = await fetch('https://en.wikipedia.org/w/api.php?action=parse&page=List_of_current_United_States_governors&prop=wikitext&format=json', {
      headers: { 'User-Agent': 'Carrot/1.0' },
      signal: AbortSignal.timeout(15000)
    }).catch(() => null)
    const data = response ? await response.json().catch(() => null) : null
    governorText = { at: Date.now(), wiki: data?.parse?.wikitext?.['*'] || '' }
  }
  const marker = `Governor of ${stateName}|`
  const at = governorText.wiki.indexOf(marker)
  if (at < 0) return null
  const match = governorText.wiki.slice(at, at + 900).match(/\{\{sortname\|([^|}]+)\|([^|}]+)/)
  if (!match) return null
  return { id: `${state}-governor`, name: `${match[1].trim()} ${match[2].trim()}`, office: `Governor of ${stateName}`, party: '', state, level: 'state' }
}

async function twitterOf(bioguide: string): Promise<string> {
  if (!handles) {
    const rows = await readJson('https://unitedstates.github.io/congress-legislators/legislators-social-media.json').catch(() => []) as { id?: { bioguide?: string }; social?: { twitter?: string } }[]
    handles = new Map()
    for (const row of Array.isArray(rows) ? rows : []) {
      if (row.id?.bioguide && row.social?.twitter) handles.set(row.id.bioguide, row.social.twitter)
    }
  }
  return handles.get(bioguide) || ''
}

export async function lineupForZip(zip: string): Promise<{ place: string; people: Official[] }> {
  const code = zip.replace(/\D/g, '').slice(0, 5)
  if (code.length !== 5) throw new Error('Enter a 5-digit zip code.')
  const cached = lineups.get(code)
  if (cached && Date.now() - cached.at < 24 * 60 * 60 * 1000) return { place: cached.place, people: cached.people }

  const placeData = await readJson(`https://api.zippopotam.us/us/${code}`) as {
    places?: { 'place name'?: string; longitude?: string; latitude?: string; state?: string }[]
  }
  const place = placeData.places?.[0]
  if (!place?.latitude || !place.longitude || !place.state) throw new Error('That zip code did not resolve.')
  const stateName = place.state
  const label = `${place['place name'] || stateName}, ${stateName}`

  const geo = await readJson(
    `https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x=${place.longitude}&y=${place.latitude}&benchmark=4&vintage=4&layers=54,56,58&format=json`
  ) as { result?: { geographies?: Record<string, { CD120?: string; STATE?: string; SLDU?: string; SLDL?: string; NAME?: string }[]> } }
  const geos = geo.result?.geographies || {}
  const congress = Object.values(geos).flat().find((row) => row.CD120)
  const upper = Object.values(geos).flat().find((row) => row.SLDU)
  const lower = Object.values(geos).flat().find((row) => row.SLDL)
  const state = FIPS[congress?.STATE || upper?.STATE || ''] || ''
  const people = await legislators()
  const lineup: Official[] = []
  if (state && congress?.CD120) {
    const member = houseMember(people, state, Number(congress.CD120))
    if (member) lineup.push(member)
  }
  if (state) lineup.push(...senators(people, state))

  let extraDistricts: number[] = []
  try {
    const older = await readJson(`https://whoismyrepresentative.com/getall_mems.php?zip=${code}&output=json`) as { results?: { district?: string; state?: string }[] }
    extraDistricts = (older.results || [])
      .map((row) => Number(row.district))
      .filter((district) => Number.isInteger(district) && district > 0 && String(district) !== congress?.CD120)
  } catch {
    extraDistricts = []
  }
  for (const district of extraDistricts) {
    if (!state) break
    const member = houseMember(people, state, district)
    if (member && !lineup.some((item) => item.id === member.id)) lineup.push(member)
  }

  const statePages: Promise<Official | null>[] = []
  if (upper?.SLDU) {
    const district = Number(upper.SLDU)
    statePages.push(stateOfficial(`${state}-sldu-${upper.SLDU}`, upper.NAME || `State Senate district ${district}`, state, [`${stateName}'s ${ordinal(district)} State Senate district`]))
  }
  if (lower?.SLDL) {
    const district = Number(lower.SLDL)
    const label = lower.NAME || `State House district ${district}`
    const possessive = `${stateName}'s ${ordinal(district)}`
    const pages = /assembly/i.test(label)
      ? [`${possessive} State Assembly district`]
      : [`${possessive} House of Representatives district`, `${possessive} State House district`, `${possessive} State Assembly district`]
    statePages.push(stateOfficial(`${state}-sldl-${lower.SLDL}`, label, state, pages))
  }
  statePages.push(governorOf(stateName, state))
  const statePeople = (await Promise.all(statePages)).filter((item): item is Official => Boolean(item))
  for (const person of lineup) {
    const handle = await twitterOf(person.id)
    if (handle) person.handle = handle
  }
  const all = [...lineup, ...statePeople]
  lineups.set(code, { at: Date.now(), place: label, people: all })
  return { place: label, people: all }
}

export async function storiesFor(name: string): Promise<Story[]> {
  const key = name.trim()
  const cached = storyCache.get(key)
  if (cached && Date.now() - cached.at < 30 * 60 * 1000) return cached.stories
  const response = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(`"${key}"`)}&hl=en-US&gl=US&ceid=US:en`, {
    headers: { 'User-Agent': 'Carrot/1.0' },
    signal: AbortSignal.timeout(12000)
  })
  if (!response.ok) return []
  const xml = await response.text()
  const stories = xml.split('<item>').slice(1, 4).map((item) => {
    const raw = (item.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '').replace(/<!\[CDATA\[|\]\]>/g, '').trim()
    const url = (item.match(/<link>([\s\S]*?)<\/link>/)?.[1] || '').trim()
    const pieces = raw.split(' - ')
    const source = pieces.length > 1 ? pieces.pop() || '' : ''
    return { title: pieces.join(' - '), url, source }
  }).filter((story) => story.title && story.url)
  storyCache.set(key, { at: Date.now(), stories })
  return stories
}

function statusText(row: { text?: unknown; raw_text?: unknown }): string {
  const raw = row.raw_text
  const nested = raw && typeof raw === 'object' && 'text' in raw && typeof (raw as { text?: unknown }).text === 'string' ? (raw as { text: string }).text : ''
  const value = typeof row.text === 'string' ? row.text : typeof raw === 'string' ? raw : nested
  return value.replace(/\s+/g, ' ').trim()
}

export async function postsFor(handle: string): Promise<SocialPost[]> {
  const key = handle.replace(/^@/, '').trim()
  if (!key) return []
  const cached = postCache.get(key)
  if (cached && Date.now() - cached.at < 30 * 60 * 1000) return cached.posts
  const endpoint = new URL('https://api.fxtwitter.com/2/search')
  endpoint.searchParams.set('q', `from:${key}`)
  endpoint.searchParams.set('count', '3')
  const response = await fetch(endpoint, {
    headers: { 'User-Agent': 'Carrot/1.0', Accept: 'application/json' },
    signal: AbortSignal.timeout(8000)
  }).catch(() => null)
  const data = response ? await response.json().catch(() => null) : null
  const rows = Array.isArray(data?.results) ? data.results : []
  const posts = rows.flatMap((row: { text?: unknown; raw_text?: unknown; url?: string; id?: string; author?: { screen_name?: string } }) => {
    const text = statusText(row)
    const author = row.author?.screen_name || key
    const url = row.url || (row.id ? `https://x.com/${author}/status/${row.id}` : '')
    if (!text || !url) return []
    return [{ text: text.slice(0, 220), url }]
  }).slice(0, 3)
  postCache.set(key, { at: Date.now(), posts })
  return posts
}

type DistrictOffice = { id?: { bioguide?: string }; offices?: { city?: string; phone?: string; address?: string; suite?: string; state?: string; zip?: string }[] }
let officeBook: { at: number; rows: DistrictOffice[] } | null = null

async function districtOffices(): Promise<DistrictOffice[]> {
  if (officeBook && Date.now() - officeBook.at < 12 * 60 * 60 * 1000) return officeBook.rows
  const rows = await readJson('https://unitedstates.github.io/congress-legislators/legislators-district-offices.json').catch(() => []) as DistrictOffice[]
  officeBook = { at: Date.now(), rows: Array.isArray(rows) ? rows : [] }
  return officeBook.rows
}

function cleanText(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#0*39;/g, "'")
    .replace(/&#0*8217;|&#0*8216;/g, "'")
    .replace(/&#0*8220;|&#0*8221;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function staffFromHtml(html: string): StaffLine[] {
  const found: StaffLine[] = []
  const pattern = /mailto:([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/gi
  let match: RegExpExecArray | null
  while ((match = pattern.exec(html)) && found.length < 16) {
    const email = decodeURIComponent(match[1]).replace(/\s+/g, '').toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue
    if (/sentry|wixpress|example\.com|googleapis|schema\.org|w3\.org/.test(email)) continue
    if (found.some((row) => row.email === email)) continue
    const local = email.split('@')[0]
    const role = /^press/.test(local) ? 'Press' : /^schedul/.test(local) ? 'Scheduling' : /^media/.test(local) ? 'Media' : ''
    found.push({ name: '', role, email, phone: '' })
  }
  return found
}

const BROWSER = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36', Accept: 'text/html,application/rss+xml,application/xml,*/*' }

async function readText(url: string, ms = 12000): Promise<string> {
  const response = await fetch(url, { headers: BROWSER, signal: AbortSignal.timeout(ms) }).catch(() => null)
  if (!response?.ok) return ''
  return response.text().catch(() => '')
}

const STATES = ['Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming']

function dropState(value: string): string {
  const trimmed = value.replace(/^\d{3}-\d{3}-\d{4}\s*/, '').trim()
  const state = STATES.find((name) => trimmed.toLowerCase().endsWith(name.toLowerCase()))
  return (state ? trimmed.slice(0, -state.length) : trimmed).replace(/\s+/g, ' ').trim()
}

type DirectoryBook = { house: { member: string; state: string; district: string; role: string; name: string; email: string; phone: string }[]; senate: DirectoryBook['house'] }
let directoryBook: { at: number; book: DirectoryBook } | null = null

async function pdfText(url: string): Promise<string> {
  const response = await fetch(url, { headers: BROWSER, signal: AbortSignal.timeout(20000) }).catch(() => null)
  if (!response?.ok) return ''
  const bytes = new Uint8Array(await response.arrayBuffer())
  const { PDFParse } = await import('pdf-parse')
  const parser = new PDFParse({ data: bytes })
  try {
    const result = await parser.getText()
    return String(result?.text || '')
  } finally {
    await parser.destroy().catch(() => undefined)
  }
}

function directoryRows(text: string, chamber: 'house' | 'senate') {
  const flat = text.replace(/\s+/g, ' ')
  const emailRe = chamber === 'house' ? /[a-z0-9._%+-]+@mail\.house\.gov/gi : /[a-z0-9._%+-]+@[a-z0-9.-]*senate\.gov/gi
  const found = [...flat.matchAll(emailRe)]
  return found.flatMap((match, index) => {
    const email = match[0].toLowerCase()
    const at = match.index || 0
    const previous = index === 0 ? 0 : (found[index - 1].index || 0) + found[index - 1][0].length
    const chunk = flat.slice(previous, at)
    const phone = flat.slice(at + match[0].length, at + match[0].length + 20).match(/\d{3}-\d{3}-\d{4}/)?.[0] || ''
    if (chamber === 'house') {
      const member = chunk.match(/Representative\s+(.+)$/i)?.[1]?.trim() || ''
      const district = chunk.match(/\b([A-Z]{2})-(\d{1,2})\b/)
      const role = chunk.match(/[A-Z]{2}-\d{1,2}\s+(.+?)\s+Representative\s+/i)?.[1]?.trim() || 'Legislative Director'
      const name = dropState((chunk.split(/\b[A-Z]{2}-\d{1,2}\b/)[0] || '').trim())
      if (!member) return []
      return [{ member, state: district?.[1] || '', district: String(Number(district?.[2] || '')), role, name, email, phone }]
    }
    const member = chunk.match(/Senator\s+(.+)$/i)?.[1]?.trim() || ''
    const state = chunk.match(/\b([A-Z]{2})\s+(?:Democratic|Republican|Independent)\b/)?.[1] || ''
    const role = chunk.match(/(?:Democratic|Republican|Independent)\s+(.+?)\s+Senator\s+/i)?.[1]?.replace(/\s+/g, ' ').trim() || 'Legislative Director'
    const head = (chunk.split(/\b(?:Democratic|Republican|Independent)\b/)[0] || '')
    const name = head.match(/([A-Z][A-Za-z'’.-]+(?:\s+[A-Z][A-Za-z'’.-]+){0,3})\s+[A-Z]{2}\s*$/)?.[1] || ''
    if (!member) return []
    return [{ member, state, district: '', role, name, email, phone }]
  })
}

async function legislativeDirectory(): Promise<DirectoryBook> {
  if (directoryBook && Date.now() - directoryBook.at < 12 * 60 * 60 * 1000) return directoryBook.book
  const [houseText, senateText] = await Promise.all([
    pdfText("https://s3.amazonaws.com/download.us.aaslh.org/Legislative+Director+Contacts+-+House+Full+LD's+Contacts+(1).pdf"),
    pdfText('https://download.aaslh.org/Legislative+Director+Contacts+2024.04.pdf')
  ])
  const book = { house: directoryRows(houseText, 'house'), senate: directoryRows(senateText, 'senate') }
  if (book.house.length > 50 && book.senate.length > 50) directoryBook = { at: Date.now(), book }
  return book
}

function listedStaff(person: Official, book: DirectoryBook): StaffLine[] {
  const senate = /senate/i.test(person.office)
  const house = /house/i.test(person.office)
  if (!senate && !house) return []
  const surname = lastName(person.name)
  const district = person.office.match(/district\s+(\d+)/i)?.[1] || ''
  return (senate ? book.senate : book.house).flatMap((row) => {
    if (!new RegExp(`\\b${surname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(row.member)) return []
    if (person.state && row.state && person.state !== row.state) return []
    if (house && district && row.district && district !== row.district) return []
    return [{ name: row.name, role: `${row.role} · directory Apr 2024`, email: row.email, phone: row.phone || person.phone || '' }]
  })
}

const STAFF_TITLES = 'Chief of Staff|Deputy Chief of Staff|Legislative Director|Communications Director|Press Secretary|Deputy Press Secretary|Director of Scheduling|Scheduler|District Director|State Director|Policy Director|Counsel'

function namesFromHtml(html: string, phone: string): StaffLine[] {
  const text = cleanText(html)
  const titles = STAFF_TITLES
  const forward = [...text.matchAll(new RegExp(`([A-Z][A-Za-z'’.-]+(?:\\s+[A-Z][A-Za-z'’.-]+){1,2})\\s+(${titles})\\b`, 'g'))]
  const backward = [...text.matchAll(new RegExp(`\\b(${titles})\\s+([A-Z][A-Za-z'’.-]+(?:\\s+[A-Z][A-Za-z'’.-]+){1,2})`, 'g'))]
  const found: StaffLine[] = []
  for (const match of forward) found.push({ name: match[1], role: match[2], email: '', phone })
  for (const match of backward) found.push({ name: match[2], role: match[1], email: '', phone })
  return found.filter((row, index) => found.findIndex((item) => item.name === row.name && item.role === row.role) === index).slice(0, 14)
}

async function staffOnSite(website: string, officePhone = ''): Promise<StaffLine[]> {
  if (!website) return []
  let origin = ''
  try {
    origin = new URL(website).origin
  } catch {
    return []
  }
  const paths = ['/contact', '/contact/', '/staff', '/staff-directory', '/contact/staff-directory', '/services/staff-directory', '/about/staff']
  const pages = await Promise.all(paths.map(async (path) => ({ path, html: await readText(`${origin}${path}`, 7000) })))
  const mailed = pages.flatMap((page) => staffFromHtml(page.html))
  const named = pages.filter((page) => /staff/.test(page.path)).flatMap((page) => namesFromHtml(page.html, officePhone))
  const found = [...named, ...mailed]
  return found.filter((row, index) => found.findIndex((item) => (row.email && item.email === row.email) || (row.name && item.name === row.name && item.role === row.role)) === index).slice(0, 16)
}

type HouseEmployee = { name?: string; jobTitle?: string; telephone?: string; worksFor?: { name?: string } }
let houseBook: { at: number; rows: HouseEmployee[] } | null = null

function prettyPhone(value: string): string {
  const digits = value.replace(/\D/g, '')
  const local = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
  if (local.length !== 10) return value.trim()
  return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`
}

function prettyName(value: string): string {
  const cleaned = value.replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()
  const comma = cleaned.indexOf(',')
  if (comma < 0) return cleaned
  return `${cleaned.slice(comma + 1).trim()} ${cleaned.slice(0, comma).trim()}`.replace(/\s+/g, ' ')
}

async function housePhonebook(): Promise<HouseEmployee[]> {
  if (houseBook && Date.now() - houseBook.at < 12 * 60 * 60 * 1000) return houseBook.rows
  const html = await readText('https://directory.house.gov/', 25000)
  const marker = html.indexOf('"jobTitle"')
  const start = marker < 0 ? -1 : html.lastIndexOf('[', marker)
  const end = start < 0 ? -1 : html.indexOf(']);', start)
  if (start < 0 || end < 0) return []
  const rows = JSON.parse(html.slice(start, end + 1)) as HouseEmployee[]
  if (rows.length > 1000) houseBook = { at: Date.now(), rows }
  return rows
}

function staffFromHouse(person: Official, rows: HouseEmployee[]): StaffLine[] {
  const surname = lastName(person.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const first = person.name.replace(/[^A-Za-z\s]/g, ' ').split(/\s+/).find((part) => part.length > 1 && part.toLowerCase() !== lastName(person.name).toLowerCase()) || ''
  const senior = /chief|director|counsel|press|communications|legislative|scheduler|advisor|liaison|policy/i
  const skip = /cloakroom|fellow|intern|system administrator|driver/i
  const hits = rows.flatMap((row) => {
    const office = (row.worksFor?.name || '').replace(/&amp;/g, '&')
    const personal = new RegExp(`^${surname},\\s+${first}`, 'i').test(office)
    const leadership = Boolean(first) && new RegExp(first, 'i').test(office) && new RegExp(`\\b${surname}\\b`, 'i').test(office) && !personal
    if (!personal && !leadership) return []
    const role = (row.jobTitle || '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()
    if (!role || skip.test(role)) return []
    if (leadership && !senior.test(role)) return []
    const phone = prettyPhone(row.telephone || '')
    const name = prettyName(row.name || '')
    if (!name || !phone) return []
    return [{ name, role, email: '', phone, personal }]
  })
  const unique = hits.filter((row, index) => hits.findIndex((item) => item.name === row.name && item.role === row.role) === index)
  unique.sort((a, b) => Number(b.personal) - Number(a.personal))
  return unique.slice(0, 20).map(({ name, role, email, phone }) => ({ name, role, email, phone }))
}

let georgiaDirectory: { at: number; staff: StaffLine[] } | null = null

async function georgiaGovernorStaff(): Promise<StaffLine[]> {
  if (georgiaDirectory && Date.now() - georgiaDirectory.at < 12 * 60 * 60 * 1000) return georgiaDirectory.staff
  const html = await readText('https://team.georgia.gov/directory/print', 20000)
  const lower = html.toLowerCase()
  const start = lower.indexOf('office of the governor')
  const end = lower.indexOf('board of regents', start + 20)
  const slice = start >= 0 ? html.slice(start, end > start ? end : start + 60000) : ''
  const staff: StaffLine[] = []
  const tables = slice.match(/<table[\s\S]*?<\/table>/gi) || []
  for (const table of tables) {
    const rows = table.match(/<tr[\s\S]*?<\/tr>/gi) || []
    for (const row of rows) {
      const cells = [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => cleanText(cell[1]))
      if (cells.length < 3 || /employee name/i.test(cells[0])) continue
      const email = (cells[2].match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i) || [''])[0].toLowerCase()
      const phone = (cells[3] || '').match(/\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/)?.[0] || '(404) 656-1776'
      const name = cells[0].replace(/^[A-Z]{2}\s/, '')
      const role = cells[1] || ''
      if (!name) continue
      if (email && staff.some((item) => item.email === email)) continue
      staff.push({ name, role, email, phone })
    }
  }
  if (!staff.some((item) => item.email === 'brian.kemp@georgia.gov')) {
    staff.unshift({ name: 'Brian P. Kemp', role: 'Governor', email: 'brian.kemp@georgia.gov', phone: '(404) 656-1776' })
  }
  if (slice.length > 1000) georgiaDirectory = { at: Date.now(), staff }
  return staff
}

function tagOf(xml: string, tag: string): string {
  const value = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'))?.[1] || ''
  return cleanText(value.replace(/<!\[CDATA\[|\]\]>/g, ''))
}

function rssEntries(xml: string, limit = 8): { title: string; url: string; detail: string; at: string }[] {
  return xml.split('<item>').slice(1, limit + 1).flatMap((item) => {
    const title = tagOf(item, 'title')
    const url = (item.match(/<link>([\s\S]*?)<\/link>/)?.[1] || tagOf(item, 'link') || '').trim()
    const at = tagOf(item, 'pubDate')
    const detail = tagOf(item, 'description').slice(0, 280)
    if (!title || !url) return []
    return [{ title, url, detail, at }]
  })
}

let sharedFeeds: { at: number; house: string; senate: string; hearings: string } | null = null

async function congressFeeds(): Promise<{ house: string; senate: string; hearings: string }> {
  if (sharedFeeds && Date.now() - sharedFeeds.at < 3 * 60 * 1000) return sharedFeeds
  const [house, senate, hearings] = await Promise.all([
    readText('https://www.congress.gov/rss/house-floor-today.xml'),
    readText('https://www.congress.gov/rss/senate-floor-today.xml'),
    readText('https://www.govinfo.gov/rss/chrg.xml')
  ])
  sharedFeeds = { at: Date.now(), house, senate, hearings }
  return sharedFeeds
}

function lastName(name: string): string {
  const parts = name.replace(/[^A-Za-z\s]/g, ' ').split(/\s+/).filter((part) => part.length > 2 && !/^(jr|sr|iii|iv)$/i.test(part))
  return parts[parts.length - 1] || name
}

function officialFeed(website: string): string {
  try {
    const origin = new URL(website).origin
    if (/senate\.gov$/i.test(origin)) return `${origin}/feed/`
    if (/house\.gov$/i.test(origin)) return `${origin}/feed/`
    return `${origin}/rss.xml`
  } catch {
    return ''
  }
}

const feedCache = new Map<string, { at: number; items: FeedItem[] }>()

async function mentions(name: string, ownHandle: string, topic = ''): Promise<{ text: string; url: string; author: string }[]> {
  const endpoint = new URL('https://api.fxtwitter.com/2/search')
  endpoint.searchParams.set('q', topic ? `"${name}" "${topic}"` : `"${name}"`)
  endpoint.searchParams.set('count', '5')
  const response = await fetch(endpoint, { headers: { 'User-Agent': 'Carrot/1.0', Accept: 'application/json' }, signal: AbortSignal.timeout(8000) }).catch(() => null)
  const data = response ? await response.json().catch(() => null) : null
  const rows = Array.isArray(data?.results) ? data.results : []
  return rows.flatMap((row: { text?: unknown; raw_text?: unknown; url?: string; id?: string; author?: { screen_name?: string } }) => {
    const text = statusText(row)
    const author = row.author?.screen_name || ''
    const url = row.url || (row.id && author ? `https://x.com/${author}/status/${row.id}` : '')
    const surname = name.split(' ').filter(Boolean).pop() || name
    if (!text || !url || author.toLowerCase() === ownHandle.toLowerCase()) return []
    if (!new RegExp(surname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(text)) return []
    return [{ text: text.slice(0, 240), url, author }]
  }).slice(0, 4)
}

export async function activityFor(person: Official, topic = ''): Promise<FeedItem[]> {
  const needle = topic.trim()
  const cacheKey = needle ? `${person.id}|${needle.toLowerCase()}` : person.id
  const cached = feedCache.get(cacheKey)
  if (cached && Date.now() - cached.at < 3 * 60 * 1000) return cached.items
  const surname = lastName(person.name)
  const site = person.website ? officialFeed(person.website) : ''
  const spoken = person.name.replace(/[^A-Za-z\s]/g, ' ').split(/\s+/).filter((part) => part.length > 1)
  const searchName = spoken.length > 1 ? `${spoken[0]} ${spoken[spoken.length - 1]}` : person.name
  const newsQuery = needle
    ? `"${searchName}" "${needle}"`
    : `"${searchName}" (bill OR hearing OR committee OR legislation OR amendment OR voted OR vote)`
  const aboutTopic = (value: string) => !needle || new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(value)
  const [ownFeed, newsXml, floor, ownPosts, seen] = await Promise.all([
    site ? readText(site) : Promise.resolve(''),
    readText(`https://news.google.com/rss/search?q=${encodeURIComponent(newsQuery)}&hl=en-US&gl=US&ceid=US:en`),
    congressFeeds(),
    person.handle ? postsFor(person.handle).catch(() => []) : Promise.resolve([]),
    mentions(searchName, person.handle || '', needle).catch(() => [])
  ])
  const newsEntries = rssEntries(newsXml, needle ? 8 : 5)
  const items: FeedItem[] = []
  const push = (kind: FeedItem['kind'], title: string, url: string, source: string, detail = '', at = '') => {
    if (!title || !url || items.some((item) => item.url === url)) return
    items.push({ id: `${person.id}:${kind}:${items.length}`, personId: person.id, personName: person.name, kind, title, detail, url, source, at })
  }
  for (const entry of rssEntries(ownFeed, 6)) {
    if (!aboutTopic(`${entry.title} ${entry.detail}`)) continue
    const hearing = /hearing|committee/i.test(`${entry.title} ${entry.detail}`)
    const bill = /bill|act|legislation|amendment|resolution|vote/i.test(`${entry.title} ${entry.detail}`)
    push(hearing ? 'hearing' : bill ? 'bill' : 'news', entry.title, entry.url, 'Official site', entry.detail, entry.at)
  }
  for (const entry of newsEntries) {
    if (needle && !aboutTopic(`${entry.title} ${entry.detail}`)) continue
    const pieces = entry.title.split(' - ')
    const source = pieces.length > 1 ? pieces.pop() || '' : 'News'
    const hearing = /hearing|committee/i.test(entry.title)
    const bill = /bill|act|legislation|amendment|vote/i.test(entry.title)
    push(hearing ? 'hearing' : bill ? 'bill' : 'news', pieces.join(' - '), entry.url, source, '', entry.at)
  }
  const floorText = `${floor.house}\n${floor.senate}`
  for (const entry of rssEntries(floorText, 30)) {
    if (!new RegExp(surname, 'i').test(`${entry.title} ${entry.detail}`)) continue
    if (!aboutTopic(`${entry.title} ${entry.detail}`)) continue
    push('bill', entry.title, entry.url, 'Congress.gov', entry.detail, entry.at)
  }
  for (const entry of rssEntries(floor.hearings, 40)) {
    if (!new RegExp(surname, 'i').test(`${entry.title} ${entry.detail}`)) continue
    if (!aboutTopic(`${entry.title} ${entry.detail}`)) continue
    push('hearing', entry.title, entry.url, 'GovInfo', entry.detail, entry.at)
  }
  for (const post of ownPosts) {
    if (!aboutTopic(post.text)) continue
    push('post', post.text, post.url, person.handle ? `@${person.handle}` : 'X')
  }
  for (const post of seen) {
    if (!aboutTopic(post.text)) continue
    push('mention', post.text, post.url, post.author ? `@${post.author}` : 'X')
  }
  feedCache.set(cacheKey, { at: Date.now(), items })
  return items
}

export async function enrichOfficials(people: Official[]): Promise<Official[]> {
  const offices = await districtOffices()
  const [directory, houseRows] = await Promise.all([
    legislativeDirectory().catch(() => ({ house: [], senate: [] })),
    housePhonebook().catch(() => [] as HouseEmployee[])
  ])
  const book = new Map(offices.map((row) => [row.id?.bioguide || '', row.offices || []]))
  return Promise.all(people.map(async (person) => {
    const lines = (book.get(person.id) || []).flatMap((office) => {
      const phone = (office.phone || '').trim()
      if (!phone) return []
      const address = [office.address, office.suite, office.city, office.state, office.zip].filter(Boolean).join(', ')
      return [{ city: office.city || office.state || 'District office', phone, address }]
    })
    const governor = /governor/i.test(person.office)
    const georgia = governor && person.state === 'GA'
    const georgiaStaff = georgia ? await georgiaGovernorStaff().catch(() => [] as StaffLine[]) : []
    const base: Official = georgia
      ? {
          ...person,
          phone: '(404) 656-1776',
          email: 'brian.kemp@georgia.gov',
          website: 'https://gov.georgia.gov',
          contactForm: 'https://gov.georgia.gov/contact-us',
          address: '206 Washington Street, Suite 203, State Capitol, Atlanta, GA 30334'
        }
      : person
    const needsStaff = !georgia && Boolean(base.website) && !base.staffChecked
    const scraped = needsStaff ? await staffOnSite(base.website || '', base.phone || '').catch(() => [] as StaffLine[]) : []
    const listed = georgia ? [] : listedStaff(base, directory)
    const phonebook = /house/i.test(base.office) ? staffFromHouse(base, houseRows) : []
    const siteStaff = needsStaff ? scraped : (base.staff || [])
    const known = [...listed, ...siteStaff]
    const withMail = phonebook.map((row) => {
      const last = lastName(row.name).toLowerCase()
      const hit = known.find((item) => item.email && (item.email.split('@')[0].toLowerCase().includes(last) || item.name.toLowerCase().includes(last)))
      return hit ? { ...row, email: hit.email } : row
    })
    const rest = known.filter((row) => {
      if (row.email && withMail.some((item) => item.email === row.email)) return false
      if (row.name && withMail.some((item) => item.name.toLowerCase() === row.name.toLowerCase())) return false
      return Boolean(row.email || row.phone)
    })
    const staff = georgia ? georgiaStaff : [...withMail, ...rest].slice(0, 24)
    const email = base.email || staff.find((row) => row.email)?.email || ''
    return {
      ...base,
      phone: base.phone || '',
      offices: lines,
      staff,
      staffChecked: true,
      email
    }
  }))
}
