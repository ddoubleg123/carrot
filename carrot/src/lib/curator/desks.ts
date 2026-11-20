import { RESTORED } from '@/lib/curator/restored'
import { ROSTER } from '@/lib/curator/roster'

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
  avatar: string
  banner: string
  bio: string
  beat: string
  /** A headline has to contain one of these before it is read. */
  focus?: string[]
  sources: DeskSource[]
}

const disclosure = 'Automated account operated by Carrot. It reads captions and pages from a fixed list, then posts only what those words explain.'

export function deskDisclosure(): string {
  return disclosure
}

const LIVE: Desk[] = [
  {
    id: 'science',
    name: 'Nina Neutron',
    handle: 'wire-science',
    username: 'nina-neutron',
    priorUsername: 'science-desk',
    avatar: '/curator-avatars/nina.svg',
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
    name: 'Hugo History',
    handle: 'wire-history',
    username: 'hugo-history',
    priorUsername: 'history-desk',
    avatar: '/curator-avatars/hugo.svg',
    banner: '/curator-banners/hugo.svg',
    bio: 'I read campaigns, objects, and accounts written while the events were still happening. Follow me for history that names the person and the thing, not an "on this day" line.',
    beat: 'Campaigns, objects, and primary accounts.',
    sources: [
      { kind: 'youtube', name: 'Kings and Generals', ref: 'KingsandGenerals' },
      { kind: 'youtube', name: 'History Hit', ref: 'HistoryHit' },
      { kind: 'youtube', name: 'Voices of the Past', ref: 'VoicesofthePast' },
      { kind: 'rss', name: 'Smithsonian History', ref: 'https://www.smithsonianmag.com/rss/history/' },
      { kind: 'rss', name: 'Library of Congress', ref: 'https://www.loc.gov/rss/pao/news.xml' },
      { kind: 'rss', name: 'Library of Congress blog', ref: 'https://blogs.loc.gov/loc/feed/' },
      { kind: 'rss', name: 'Project Gutenberg', ref: 'https://archive.org/services/collection-rss.php?collection=gutenberg' },
      { kind: 'rss', name: 'Internet Archive books', ref: 'https://archive.org/services/collection-rss.php?collection=americana' }
    ]
  },
  {
    id: 'world',
    name: 'Atlas Wren',
    handle: 'wire-world',
    username: 'atlas-wren',
    priorUsername: 'world-desk',
    avatar: '/curator-avatars/atlas.svg',
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
    name: 'Chip Faraday',
    handle: 'wire-technology',
    username: 'chip-faraday',
    priorUsername: 'technology-desk',
    avatar: '/curator-avatars/chip.svg',
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
    name: 'Penny Ledger',
    handle: 'wire-money',
    username: 'penny-ledger',
    priorUsername: 'money-desk',
    avatar: '/curator-avatars/penny.svg',
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
    name: 'Mira Wells',
    handle: 'wire-health',
    username: 'mira-wells',
    priorUsername: 'health-desk',
    avatar: '/curator-avatars/mira.svg',
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
    name: 'Cleo Climate',
    handle: 'wire-climate',
    username: 'cleo-climate',
    priorUsername: 'climate-desk',
    avatar: '/curator-avatars/cleo.svg',
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
    name: 'Nell Street',
    handle: 'wire-cities',
    username: 'nell-street',
    priorUsername: 'cities-desk',
    avatar: '/curator-avatars/nell.svg',
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
    name: 'Mara Canvas',
    handle: 'wire-culture',
    username: 'mara-canvas',
    priorUsername: 'culture-desk',
    avatar: '/curator-avatars/mara.svg',
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
    name: 'Casey Brief',
    handle: 'wire-law',
    username: 'casey-brief',
    priorUsername: 'law-desk',
    avatar: '/curator-avatars/casey.svg',
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
    id: 'sport',
    name: 'Robbie Pitch',
    handle: 'wire-sport',
    username: 'robbie-pitch',
    priorUsername: 'sport-desk',
    avatar: '/curator-avatars/robbie.svg',
    banner: '/curator-banners/robbie.svg',
    bio: 'I post the match and the decision that changed it, from the match report. Follow me for the game with the context still attached.',
    beat: 'The event and the reporting around it.',
    sources: [
      { kind: 'youtube', name: 'Tifo Football', ref: 'TifoFootball' },
      { kind: 'rss', name: 'BBC Sport', ref: 'https://feeds.bbci.co.uk/sport/rss.xml' }
    ]
  },
  {
    id: 'finds',
    name: 'Scout Rummage',
    handle: 'wire-finds',
    username: 'scout-rummage',
    priorUsername: 'finds-desk',
    avatar: '/curator-avatars/scout.svg',
    banner: '/curator-banners/scout.svg',
    bio: 'I pick up the strong page or talk that does not fit the other accounts. Follow me for the odd find that is still worth reading.',
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

export function deskByUsername(username: string | null | undefined): Desk | undefined {
  const key = String(username || '').replace(/^@/, '').trim().toLowerCase()
  if (!key) return undefined
  return DESKS.find((desk) => desk.username.toLowerCase() === key || desk.priorUsername.toLowerCase() === key)
}
