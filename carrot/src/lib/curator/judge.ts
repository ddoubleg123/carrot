const FILLER = /\b(like and subscribe|smash the like|link in the (description|bio)|use code|sponsor(ed|s)?|today's sponsor|leverage|trench\.io)\b/gi
const SPONSOR = /\b(like and subscribe|smash the like|link in the (description|bio)|use code|sponsor(ed|s)?|today's sponsor|leverage|trench\.io|promo code)\b/i
const CLICK = /\b(you won't believe|gone wrong|top\s?\d+|must[- ]see|shocking|prank)\b/i
const INTRO = /^(hey |hi |hello |welcome |what is up|what's up|in this video|today we|subscribe|thanks for watching)/i

export interface Reading {
  keep: boolean
  reason: string
  words: number
  excerpt: string
  summary: string
}

function stripChrome(text: string): string {
  return text
    .replace(/skip to (?:the )?(?:main )?content/gi, ' ')
    .replace(/your source for the latest research news/gi, ' ')
    .replace(/science news from research organizations/gi, ' ')
    .replace(/\bDate:\s+[A-Za-z]+ \d{1,2}, \d{4}/g, ' ')
    .replace(/\bSource:\s+[^.]+/g, ' ')
    .replace(/\bSummary:\s+/g, ' ')
    .replace(/\bshare:\s*(?:twitter|pinterest|email|\s+)*/gi, ' ')
    .replace(/\bfull story\b/gi, ' ')
    .replace(/follow:\s*/gi, ' ')
    .replace(/subscribe:\s*/gi, ' ')
    .replace(/\b(facebook|x\/twitter|instagram|linkedin|rss feeds?|newsletter|all rights reserved)\b/gi, ' ')
    .replace(/image source,?\s*/gi, ' ')
    .replace(/getty images/gi, ' ')
    .replace(/image caption,?\s*/gi, ' ')
    .replace(/photograph:\s*[^.]{0,120}/gi, ' ')
    .replace(/view image in fullscreen/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function sentences(text: string): string[] {
  return stripChrome(text)
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter((part) => part.length >= 60 && part.length <= 420 && !/^(skip to|sign in|subscribe|cookie|share this|follow us|menu)\b/i.test(part) && !/\b(pinterest|full story|share:|image source|getty images|image caption|photograph:)\b/i.test(part) && !SPONSOR.test(part))
}

export function judgeReading(text: string, title: string, kind: 'video' | 'page' | 'post'): Reading {
  const clean = stripChrome(text)
  const words = clean.split(/\s+/).filter(Boolean)
  const minWords = kind === 'video' ? 320 : kind === 'page' ? 180 : 40
  if (words.length < minWords) {
    return { keep: false, reason: kind === 'video' ? 'The captions are too short to be a real talk.' : 'There is not enough text to judge it.', words: words.length, excerpt: '', summary: '' }
  }
  if (/\bofficial website of the united states\b|here'?s how you know|\.gov website belongs|back to home board of governors/i.test(clean)) {
    return { keep: false, reason: 'The page is a site banner, not an idea.', words: words.length, excerpt: '', summary: '' }
  }
  if (CLICK.test(title) || /#shorts\b/i.test(title)) {
    return { keep: false, reason: 'The title is a short or a pitch, not an explanation.', words: words.length, excerpt: '', summary: '' }
  }
  const filler = clean.match(FILLER)?.length || 0
  if (filler >= 4 && words.length < 900) {
    return { keep: false, reason: 'Most of the opening is a sponsorship pitch.', words: words.length, excerpt: '', summary: '' }
  }
  const unique = new Set(words.map((word) => word.toLowerCase()))
  if (unique.size / words.length < 0.28) {
    return { keep: false, reason: 'The words repeat. It does not explain a subject.', words: words.length, excerpt: '', summary: '' }
  }
  const usable = sentences(clean).filter((line) => !INTRO.test(line))
  if (usable.length < (kind === 'post' ? 1 : 4)) {
    return { keep: false, reason: 'It never settles into a clear explanation.', words: words.length, excerpt: '', summary: '' }
  }
  const concrete = usable.filter((line) => /\d/.test(line) || /[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+/.test(line))
  const chosen = (concrete.length >= 2 ? concrete : usable).slice(0, kind === 'page' ? 2 : 3)
  const excerpt = chosen.join(' ').slice(0, kind === 'page' ? 460 : 720)
  const lead = chosen[0] || excerpt
  const summary = lead.length > 280 ? `${lead.slice(0, 277).trim()}…` : lead
  return { keep: true, reason: 'The words explain a specific subject.', words: words.length, excerpt, summary }
}

export function sameStory(left: string, right: string): boolean {
  const words = (value: string) => value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((word) => word.length > 3 && !STOP.has(word))
  const a = words(left)
  const b = new Set(words(right))
  if (a.length < 3 || b.size < 3) return false
  const shared = a.filter((word) => b.has(word)).length
  return shared >= 3 && shared / Math.min(a.length, b.size) >= 0.6
}

const STOP = new Set(['this', 'that', 'with', 'from', 'have', 'what', 'when', 'your', 'about', 'into', 'after', 'before', 'their', 'there', 'would', 'could', 'should', 'video', 'watch', 'news'])
