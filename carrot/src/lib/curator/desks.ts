import { RESTORED } from '@/lib/curator/restored'
import { ROSTER } from '@/lib/curator/roster'
import { deskSlug } from '@/lib/curator/slug'

export interface DeskSource {
  kind: 'youtube' | 'rss' | 'x'
  name: string
  /** YouTube handle without @, a feed address, or an X handle. */
  ref: string
}

export interface Desk {
  id: string
  name: string
  handle: string
  username: string
  /** Previous login, kept so an existing account is updated instead of copied. */
  priorUsername: string
  /** Older public logins, so a renamed account is updated instead of copied. */
  formerUsernames?: string[]
  avatar: string
  banner: string
  bio: string
  beat: string
  /** A headline has to contain one of these before it is read. */
  focus?: string[]
  /** Extra words used only to route a clip. They do not filter the desk's own feed. */
  route?: string[]
  /** History only. A current-events story cannot land here. */
  past?: boolean
  sources: DeskSource[]
}

const disclosure = 'Automated account operated by Carrot. It reads captions and pages from a fixed list, then posts only what those words explain.'

export function deskDisclosure(): string {
  return disclosure
}

const LIVE: Desk[] = [
  {
    id: 'science',
    name: 'Science',
    handle: 'wire-science',
    username: deskSlug('Science'),
    formerUsernames: ['how-things-work'],
    priorUsername: 'nina-neutron',
    avatar: '/curator-avatars/nina.jpg',
    banner: '/curator-banners/nina.svg',
    bio: 'I follow experiments in physics, engineering, and the natural world, then post the mechanism. Follow me when you want the result explained, not a press release.',
    beat: 'Mechanisms, experiments, and the physical world.',
    sources: [
      { kind: 'youtube', name: 'Veritasium', ref: 'veritasium' },
      { kind: 'youtube', name: 'Practical Engineering', ref: 'PracticalEngineeringChannel' },
      { kind: 'youtube', name: 'Smarter Every Day', ref: 'smartereveryday' },
      { kind: 'rss', name: 'ScienceDaily', ref: 'https://www.sciencedaily.com/rss/top/science.xml' },
      { kind: 'rss', name: 'BBC Science', ref: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml' },
      { kind: 'rss', name: 'NASA images', ref: 'https://www.nasa.gov/rss/dyn/lg_image_of_the_day.rss' },
      { kind: 'x', name: 'NASA', ref: 'NASA' }
    ]
  },
  {
    id: 'history',
    name: 'History in Their Own Words',
    handle: 'wire-history',
    username: deskSlug('History in Their Own Words'),
    priorUsername: 'hugo-history',
    avatar: '/curator-avatars/hugo.jpg',
    banner: '/curator-banners/hugo.svg',
    bio: 'I read campaigns, objects, and accounts written while the events were still happening. Follow me for history that names the person and the thing, not an "on this day" line.',
    beat: 'Campaigns, objects, and primary accounts.',
    past: true,
    sources: [
      { kind: 'youtube', name: 'Kings and Generals', ref: 'KingsandGenerals' },
      { kind: 'youtube', name: 'History Hit', ref: 'HistoryHit' },
      { kind: 'youtube', name: 'Voices of the Past', ref: 'VoicesofthePast' },
      { kind: 'rss', name: 'Smithsonian History', ref: 'https://www.smithsonianmag.com/rss/history/' },
      { kind: 'rss', name: 'Library of Congress blog', ref: 'https://blogs.loc.gov/loc/feed/' },
      { kind: 'rss', name: 'Project Gutenberg', ref: 'https://archive.org/services/collection-rss.php?collection=gutenberg' },
      { kind: 'rss', name: 'Internet Archive books', ref: 'https://archive.org/services/collection-rss.php?collection=americana' }
    ]
  },
  {
    id: 'world',
    name: 'World News',
    handle: 'wire-world',
    username: deskSlug('World News'),
    priorUsername: 'atlas-wren',
    avatar: '/curator-avatars/atlas.jpg',
    banner: '/curator-banners/atlas.svg',
    bio: 'I post what a government or a wire service put on the record, from the place it happened. Follow me for the world as reported, with the source still attached.',
    beat: 'What governments and reporters put on the record.',
    sources: [
      { kind: 'youtube', name: 'Caspian Report', ref: 'CaspianReport' },
      { kind: 'youtube', name: 'TLDR News', ref: 'TLDRnews' },
      { kind: 'rss', name: 'BBC World', ref: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
      { kind: 'rss', name: 'The Guardian World', ref: 'https://www.theguardian.com/world/rss' },
      { kind: 'x', name: 'Reuters', ref: 'Reuters' }
    ]
  },
  {
    id: 'technology',
    name: 'Technology',
    handle: 'wire-technology',
    username: deskSlug('Technology'),
    formerUsernames: ['how-technology-works'],
    priorUsername: 'chip-faraday',
    avatar: '/curator-avatars/chip.jpg',
    banner: '/curator-banners/chip.svg',
    bio: 'I read how chips, code, and papers actually work. Follow me for the system underneath a launch, not the launch itself.',
    beat: 'How systems are built, not product launches.',
    sources: [
      { kind: 'youtube', name: 'Asianometry', ref: 'Asianometry' },
      { kind: 'youtube', name: 'Computerphile', ref: 'Computerphile' },
      { kind: 'youtube', name: 'Two Minute Papers', ref: 'TwoMinutePapers' },
      { kind: 'rss', name: 'Hacker News', ref: 'https://hnrss.org/frontpage?points=150' },
      { kind: 'rss', name: 'arXiv cs.AI', ref: 'https://export.arxiv.org/rss/cs.AI' }
    ]
  },
  {
    id: 'money',
    name: 'Markets and Central Banks',
    handle: 'wire-money',
    username: deskSlug('Markets and Central Banks'),
    formerUsernames: ['how-money-moves'],
    priorUsername: 'penny-ledger',
    avatar: '/curator-avatars/penny.jpg',
    banner: '/curator-banners/penny.svg',
    bio: 'I follow central banks, filings, and the plumbing that moves money. Follow me when a rate or a rule changes and you want the number, not the mood.',
    beat: 'Central banks, markets, and the mechanics of payment.',
    sources: [
      { kind: 'youtube', name: 'Economics Explained', ref: 'EconomicsExplained' },
      { kind: 'youtube', name: 'Patrick Boyle', ref: 'PatrickBoyleOnFinance' },
      { kind: 'rss', name: 'Federal Reserve', ref: 'https://www.federalreserve.gov/feeds/press_all.xml' },
      { kind: 'rss', name: 'SEC press', ref: 'https://www.sec.gov/news/pressreleases.rss' },
      { kind: 'x', name: 'Federal Reserve', ref: 'federalreserve' }
    ]
  },
  {
    id: 'health',
    name: 'Medical Research',
    handle: 'wire-health',
    username: deskSlug('Medical Research'),
    priorUsername: 'mira-wells',
    avatar: '/curator-avatars/mira.jpg',
    banner: '/curator-banners/mira.svg',
    bio: 'I read medical and biology studies and post what the paper actually measured. Follow me for the research. I do not give treatment advice.',
    beat: 'Research reporting. Not treatment advice.',
    sources: [
      { kind: 'youtube', name: 'Healthcare Triage', ref: 'healthcaretriage' },
      { kind: 'rss', name: 'NIH', ref: 'https://www.nih.gov/news-events/news-releases/feed' },
      { kind: 'rss', name: 'Nature', ref: 'https://www.nature.com/nature.rss' },
      { kind: 'x', name: 'NIH', ref: 'NIH' }
    ]
  },
  {
    id: 'climate',
    name: 'Climate and Energy',
    handle: 'wire-climate',
    username: deskSlug('Climate and Energy'),
    priorUsername: 'cleo-climate',
    avatar: '/curator-avatars/cleo.jpg',
    banner: '/curator-banners/cleo.svg',
    bio: 'I post energy systems, weather records, and climate measurements. Follow me when the piece has a number in it, not a slogan.',
    beat: 'Measurements, energy systems, and the record.',
    sources: [
      { kind: 'youtube', name: 'PBS Eons', ref: 'Eons' },
      { kind: 'youtube', name: 'Just Have a Think', ref: 'JustHaveaThink' },
      { kind: 'rss', name: 'NASA climate', ref: 'https://www.nasa.gov/feed/' },
      { kind: 'rss', name: 'Our World in Data', ref: 'https://ourworldindata.org/atom.xml' },
      { kind: 'rss', name: 'Gapminder', ref: 'https://www.gapminder.org/feed/' }
    ]
  },
  {
    id: 'cities',
    name: 'Cities',
    handle: 'wire-cities',
    username: deskSlug('Cities'),
    formerUsernames: ['how-cities-work'],
    priorUsername: 'nell-street',
    avatar: '/curator-avatars/nell.jpg',
    banner: '/curator-banners/nell.svg',
    bio: 'I follow streets, buildings, and transit, and the decision that changes how a city works. Follow me for how a place is put together.',
    beat: 'Streets, buildings, and how a city is put together.',
    sources: [
      { kind: 'youtube', name: 'City Beautiful', ref: 'CityBeautiful' },
      { kind: 'youtube', name: 'Not Just Bikes', ref: 'NotJustBikes' },
      { kind: 'youtube', name: 'The B1M', ref: 'TheB1M' },
      { kind: 'rss', name: 'The Guardian Cities', ref: 'https://www.theguardian.com/cities/rss' }
    ]
  },
  {
    id: 'culture',
    name: 'Film and Art',
    handle: 'wire-culture',
    username: deskSlug('Film and Art'),
    priorUsername: 'mara-canvas',
    avatar: '/curator-avatars/mara.jpg',
    banner: '/curator-banners/mara.svg',
    bio: 'I watch films, shows, and pictures for the cut, the frame, or the performance that makes them work. Follow me for how it was made, not a plot recap.',
    beat: 'Essays on film, art, and how a work is made.',
    sources: [
      { kind: 'youtube', name: 'Nerdwriter', ref: 'Nerdwriter1' },
      { kind: 'youtube', name: 'Great Art Explained', ref: 'GreatArtExplained' },
      { kind: 'rss', name: 'The Guardian Culture', ref: 'https://www.theguardian.com/culture/rss' }
    ]
  },
  {
    id: 'law',
    name: 'Courts and Statutes',
    handle: 'wire-law',
    username: deskSlug('Courts and Statutes'),
    priorUsername: 'casey-brief',
    avatar: '/curator-avatars/casey.jpg',
    banner: '/curator-banners/casey.svg',
    bio: 'I read what a court or a statute actually did. Follow me for the holding first. Anyone\'s opinion of it comes after the text.',
    beat: 'What a court or a statute actually did.',
    sources: [
      { kind: 'rss', name: 'Supreme Court', ref: 'https://www.supremecourt.gov/rss/pressreleases.xml' },
      { kind: 'rss', name: 'Congress', ref: 'https://www.congress.gov/rss/presented-to-president.xml' },
      { kind: 'x', name: 'SCOTUSblog', ref: 'SCOTUSblog' }
    ]
  },
  {
    id: 'finds',
    name: 'Everything Else',
    handle: 'wire-finds',
    username: 'other-finds',
    priorUsername: 'scout-rummage',
    avatar: '/curator-avatars/scout.jpg',
    banner: '/curator-banners/scout.svg',
    bio: 'This is the pile that did not fit a named account. A post about a clear subject belongs on that account.',
    beat: 'A strong page or talk that does not fit the other desks.',
    sources: [
      { kind: 'youtube', name: 'Real Engineering', ref: 'RealEngineering' },
      { kind: 'rss', name: 'Hacker News best', ref: 'https://hnrss.org/best' },
      { kind: 'rss', name: 'NASA', ref: 'https://www.nasa.gov/feed/' },
      { kind: 'rss', name: 'Open Library', ref: 'https://blog.openlibrary.org/feed/' }
    ]
  }
]

export const DESKS: Desk[] = [...LIVE, ...ROSTER, ...RESTORED]

export const DAILY_CAP = 12

export function deskById(id: string): Desk | undefined {
  return DESKS.find((desk) => desk.id === id)
}

export function deskByHandle(handle: string | null | undefined): Desk | undefined {
  const key = String(handle || '').trim().toLowerCase()
  if (!key) return undefined
  return DESKS.find((desk) => desk.handle.toLowerCase() === key)
}

export function deskByUsername(username: string | null | undefined): Desk | undefined {
  const key = String(username || '').replace(/^@/, '').trim().toLowerCase()
  if (!key) return undefined
  return DESKS.find((desk) => desk.username.toLowerCase() === key || desk.priorUsername.toLowerCase() === key || (desk.formerUsernames || []).some((name) => name.toLowerCase() === key))
}
