import path from 'path'
import { config as loadEnv } from 'dotenv'
import type { Voice } from '@/lib/curator/voices'
import { bareWitness, brokenPost } from '@/lib/learn/nameCard'

const CHROME = /image source|getty images|image caption|photograph:|view image in fullscreen|photo credit|credit:|read more|continue reading|skip to|sign in to|cookie|all rights reserved|official website of the united states|here'?s how you know|\.gov website belongs|before we begin|day pass|like and subscribe|early readers like|big pharma/i

const CANNED = /the number is the story|worth reading the thing itself|that is the fact i wanted|the experiment is the part i stayed|that is the mechanism, not the slogan|i want the whole walkthrough|the history is in that detail|that is the part of the story i keep|worth reading past the first|the interesting part is how it is built|i stayed for the system|that is the constraint that actually matters|follow the payment and it gets clearer|the study is more specific than the headline|i kept the result, not the advice|the measurement is the interesting part|i wanted the record, not the slogan|the street is doing more work|worth walking through slowly|the making of it is the interesting part|that detail is why i kept it|what the document actually did is the story|the match report is better than the headline|this one did not fit a beat|i opened it for the title/i

function tidy(text: string): string {
  return text
    .replace(/image source,?\s*/gi, ' ')
    .replace(/getty images/gi, ' ')
    .replace(/image caption,?\s*/gi, ' ')
    .replace(/photograph:\s*[^.]{0,120}/gi, ' ')
    .replace(/view image in fullscreen/gi, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\bback to home\b/gi, ' ')
    .replace(/\bstay connected\b/gi, ' ')
    .replace(/photo credit:?\s*[^.]{0,80}/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function dropTitle(body: string, title: string): string {
  const cleanTitle = title.replace(/\s+/g, ' ').trim()
  if (!cleanTitle) return body
  const lower = body.toLowerCase()
  const head = cleanTitle.toLowerCase().slice(0, Math.min(48, cleanTitle.length))
  if (head.length > 12 && lower.startsWith(head)) {
    return body.slice(cleanTitle.length).replace(/^[\s,.:;\-–—]+/, '').trim() || body
  }
  return body
}

function dropHeadline(text: string): string {
  let next = text.replace(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s+\1\b/g, '$1')
  if (!/^(how|why|what|the rise|the full|when \w+ becomes)/i.test(next)) return next
  const words = next.split(/\s+/)
  const seen = new Map<string, number>()
  for (let i = 0; i < words.length; i++) {
    const word = words[i].toLowerCase().replace(/[^a-z0-9]/g, '')
    if (word.length < 5) continue
    const earlier = seen.get(word)
    if (earlier !== undefined && i - earlier > 2) {
      next = words.slice(earlier).join(' ')
      break
    }
    if (earlier === undefined) seen.set(word, i)
  }
  return next.replace(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s+\1\b/g, '$1')
}

function unglue(text: string): string {
  const cut = text.search(/[a-z]\s+[A-Z][a-z]+\s+(?:[a-z]+\s+){3,}/)
  if (cut < 24) return text
  const before = text.slice(0, cut + 1)
  if (/[.!?]/.test(before)) return text
  return text.slice(cut + 1).replace(/^\s+/, '')
}

function firstFact(text: string): string {
  const prepared = unglue(dropHeadline(text.replace(/^\([^)]{0,90}\)\s*/, '').replace(/^[-–—]\s*/, '')))
  const parts = prepared
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter((part) => part.length >= 55 && part.length <= 320 && !CHROME.test(part) && !CANNED.test(part))
  const concrete = parts.find((part) => /\d/.test(part) || /[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+/.test(part))
  const chosen = concrete || parts[0] || ''
  if (!chosen) return ''
  const cut = chosen.length > 220 ? `${chosen.slice(0, 217).trim()}…` : chosen
  return cut.replace(/^["“]+|["”]+$/g, '').trim()
}

function acceptable(line: string): string | null {
  const clean = line.replace(/^["“]+|["”]+$/g, '').replace(/\s+/g, ' ').trim()
  if (!clean || /^skip\b/i.test(clean)) return null
  if (clean.length < 40 || clean.length > 360) return null
  if (CHROME.test(clean) || CANNED.test(clean)) return null
  if (/^(how|why|what)\b/i.test(clean) && !/[.!?…]/.test(clean)) return null
  if (brokenPost(clean)) return null
  return clean
}

const SCENE = /\b(i was|i keep|i sat|i stood|beside me|beside mine|my desk|in my |holding room|school uniform)\b/i

/** Two short paragraphs. A line must not end in a question, or the feed lifts it into a headline. A scene is not a post. */
function spoken(text: string, person: string): string | null {
  const clean = text.replace(/^["“]+|["”]+$/g, '').trim()
  if (!clean || /^skip\b/i.test(clean)) return null
  const paragraphs = clean
    .split(/\n+/)
    .map((part) => part.replace(/\s+/g, ' ').replace(/\?+\s*$/, '.').trim())
    .filter((part) => part && !/^(title|when|from|image):/i.test(part) && !/^(what|why|how)\b/i.test(part))
    .slice(0, 2)
  const flat = paragraphs.join(' ')
  if (flat.length < 70 || flat.length > 520) return null
  if (CHROME.test(flat) || CANNED.test(flat) || SCENE.test(flat)) return null
  if (/^(i |my )\b/i.test(paragraphs[0] || '')) return null
  if (person && flat.toLowerCase().includes(person.toLowerCase())) return null
  return paragraphs.join('\n\n')
}

function fallbackLine(title: string, excerpt: string): string | null {
  const body = dropTitle(tidy(excerpt || ''), title)
  return acceptable(firstFact(body))
}

const JUNK = /\b(promo code|bonus bet|draftkings|fandulk|fanduel|betmgm|sign[- ]up bonus|league pass|coupon code|affiliate|gift guide|round-?up|shopping guide|best .{0,48}tested|face masks?)\b/i

/** 1 or 2 is the wrong desk, or too thin to tell as that desk. Those do not publish. */
export async function deskGrade(beat: string, title: string, excerpt: string): Promise<number> {
  const source = tidy(`${title}. ${excerpt}`).slice(0, 1800)
  const job = beat.replace(/\s+/g, ' ').trim()
  if (!source || !job) return 0
  const key = deepseekKey()
  if (!key) return 0
  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek-flash',
        temperature: 0,
        max_tokens: 40,
        thinking: { type: 'disabled' },
        messages: [{
          role: 'user',
          content: `This desk posts only this: ${job.slice(0, 240)}
Grade the source from 1 to 10 for that job.
1 or 2: a different subject, a metaphor stretched onto the beat, or too thin to retell as this beat.
3 or 4: the right subject, missing the concrete fact the beat exists for.
5 to 7: the right subject and one concrete fact.
8 to 10: the thing this desk exists to tell, with the detail.
Do not reward outrage. Reply JSON only: {"score":n}

${source}`
        }]
      }),
      signal: AbortSignal.timeout(20000)
    })
    if (!response.ok) return 0
    const data = await response.json().catch(() => null)
    const raw = String(data?.choices?.[0]?.message?.content || '')
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return 0
    const score = Number((JSON.parse(match[0]) as { score?: unknown }).score)
    if (!Number.isInteger(score) || score < 1 || score > 10) return 0
    return score
  } catch {
    return 0
  }
}

/** The writing instructions leaked into the post. */
export function repeatsInstructions(note: string, manner: string): boolean {
  const needle = manner.replace(/\s+/g, ' ').trim().toLowerCase()
  const hay = note.replace(/\s+/g, ' ').toLowerCase()
  if (needle.length < 24 || !hay) return false
  const size = Math.min(40, needle.length)
  for (let i = 0; i + size <= needle.length; i += 12) {
    if (hay.includes(needle.slice(i, i + size))) return true
  }
  return false
}

/** Every post, clip or page, has to be something a person would send to a friend. */
export async function worthPosting(title: string, excerpt: string): Promise<boolean> {
  const source = tidy(`${title}. ${excerpt}`).slice(0, 1800)
  if (!source || JUNK.test(source)) return false
  const key = deepseekKey()
  if (!key) return false
  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek-flash',
        temperature: 0,
        max_tokens: 80,
        thinking: { type: 'disabled' },
        messages: [{
          role: 'user',
          content: `Decide if this is worth a post. Pass only if a person would send it to a friend. It needs one concrete detail and a finished point. Fail a promo, a betting offer, a product roundup, a list of who is near a cutoff, a routine recap, a trend with no fact, and anything too thin to retell. Do not reward outrage. Reply JSON only: {"pass":true} or {"pass":false}\n\n${source}`
        }]
      }),
      signal: AbortSignal.timeout(20000)
    })
    if (!response.ok) return false
    const data = await response.json().catch(() => null)
    const raw = String(data?.choices?.[0]?.message?.content || '')
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return false
    const parsed = JSON.parse(match[0]) as { pass?: boolean }
    return parsed.pass === true
  } catch {
    return false
  }
}

/** One sentence of what the headline says happened. No question. */
export async function happened(title: string): Promise<string | null> {
  const clean = title.replace(/\s+/g, ' ').trim().slice(0, 220)
  if (!clean) return null
  const stated = !/[?？]\s*$/.test(clean) && !/^(how|why|what|who|when|where|would|will|did|does|do|is|are|can|could|should)\b/i.test(clean)
  const fallback = stated ? clean.replace(/[.!]?$/, '.') : null
  const key = deepseekKey()
  if (!key) return fallback
  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek-flash',
        temperature: 0.2,
        max_tokens: 80,
        thinking: { type: 'disabled' },
        messages: [{
          role: 'user',
          content: `Rewrite this headline as one sentence about what happened. Use only what the headline says. No question mark. No hashtag. Do not add a fact.\n\n${clean}`
        }]
      }),
      signal: AbortSignal.timeout(20000)
    })
    if (!response.ok) return fallback
    const data = await response.json().catch(() => null)
    const text = String(data?.choices?.[0]?.message?.content || '').replace(/^["“]+|["”]+$/g, '').replace(/\s+/g, ' ').trim()
    if (!text || text.length < 20 || text.length > 220 || /[?？]/.test(text) || /^skip\b/i.test(text)) return fallback
    return text.replace(/[.!]?$/, '.')
  } catch {
    return fallback
  }
}

function deepseekKey(): string {
  if (process.env.DEEPSEEK_API_KEY) return process.env.DEEPSEEK_API_KEY
  loadEnv({ path: path.join(process.cwd(), '.env.local') })
  return process.env.DEEPSEEK_API_KEY || ''
}

/** One question the source can answer. Falls back to the title when the model is down. */
export async function patchQuestion(beat: string, title: string, excerpt: string): Promise<string> {
  const cleanTitle = title.replace(/\s+/g, ' ').trim().slice(0, 160)
  const fallback = `What does the record say about ${cleanTitle.replace(/\?$/, '')}?`.slice(0, 180)
  const key = deepseekKey()
  const source = tidy(excerpt || '').slice(0, 1200)
  if (!key || !source) return fallback
  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek-flash',
        temperature: 0.3,
        max_tokens: 80,
        thinking: { type: 'disabled' },
        messages: [
          {
            role: 'user',
            content: `Write one question a careful reader would ask. It must be answerable from documents. Stay inside this beat: ${beat.slice(0, 200)}. Use only the source. One sentence ending in a question mark. No hashtags.\n\nTitle: ${cleanTitle}\n\nSource:\n${source}`
          }
        ]
      }),
      signal: AbortSignal.timeout(20000)
    })
    if (!response.ok) return fallback
    const data = await response.json().catch(() => null)
    const text = String(data?.choices?.[0]?.message?.content || '').replace(/^["“]+|["”]+$/g, '').replace(/\s+/g, ' ').trim()
    if (!text.includes('?') || text.length < 12 || text.length > 180) return fallback
    return text
  } catch {
    return fallback
  }
}

function instruction(_name: string, _voice: Voice | null, rewrite: boolean): string {
  const skip = rewrite
    ? 'Rewrite the source. It is already a post. Do not reply SKIP. Do not add a title line.'
    : 'If the page is a banner, a seal, a title, a menu, or an announcement with no idea, reply with exactly SKIP.'
  return `Say what the source says happened. One or two sentences. Who, what, and the number if it is there. Plain speech, the way a person texts a friend. No character, no metaphor, no scene, no lesson. Use only facts in the source. Do not add a name, a number, a date, or a cause. No hashtags. No question. ${skip}`
}

function keepLine(line: string | null, source: string): string | null {
  if (!line || bareWitness(line, source) || brokenPost(line)) return null
  return line
}

/** A post in the desk's voice. Null when the source has no idea. */
export async function feedLine(name: string, title: string, excerpt: string, voice: Voice | null = null, rewrite = false): Promise<string | null> {
  const source = tidy(excerpt || '').slice(0, 1800)
  if (!source || (CHROME.test(source) && source.length < 500)) return null
  const key = deepseekKey()
  if (!key) return keepLine(fallbackLine(title, source), source)
  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek-flash',
        temperature: 0.3,
        max_tokens: voice ? 280 : 180,
        thinking: { type: 'disabled' },
        messages: [
          {
            role: 'user',
            content: `${instruction(name, voice, rewrite)}\n\nTitle: ${title.slice(0, 180)}\n\nSource:\n${source}`
          }
        ]
      }),
      signal: AbortSignal.timeout(25000)
    })
    if (!response.ok) return keepLine(fallbackLine(title, source), source)
    const data = await response.json().catch(() => null)
    const text = String(data?.choices?.[0]?.message?.content || '').trim()
    if (/^skip\b/i.test(text) && !rewrite) return null
    const written = voice ? spoken(text, voice.person) : acceptable(text)
    return keepLine(written, source) || keepLine(fallbackLine(title, source), source)
  } catch {
    return keepLine(fallbackLine(title, source), source)
  }
}
