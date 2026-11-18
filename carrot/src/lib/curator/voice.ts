import path from 'path'
import { config as loadEnv } from 'dotenv'

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
  return clean
}

function fallbackLine(title: string, excerpt: string): string | null {
  const body = dropTitle(tidy(excerpt || ''), title)
  return acceptable(firstFact(body))
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

/** One or two sentences a person would post. Null when the source has no idea. */
export async function feedLine(name: string, title: string, excerpt: string): Promise<string | null> {
  const source = tidy(excerpt || '').slice(0, 1800)
  if (!source || (CHROME.test(source) && source.length < 500)) return null
  const key = deepseekKey()
  if (!key) return fallbackLine(title, source)
  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek-flash',
        temperature: 0.4,
        max_tokens: 180,
        thinking: { type: 'disabled' },
        messages: [
          {
            role: 'user',
            content: `You are ${name}, posting on a social feed. Write one or two sentences a sharp person would actually post about this. It needs a mechanism, a surprising number, a conflict, or a consequence. Use only facts in the source. No hashtags, no "check this out", no site name as the post. If the page is a banner, a seal, a title, a menu, or an announcement with no idea, reply with exactly SKIP.\n\nTitle: ${title.slice(0, 180)}\n\nSource:\n${source}`
          }
        ]
      }),
      signal: AbortSignal.timeout(25000)
    })
    if (!response.ok) return fallbackLine(title, source)
    const data = await response.json().catch(() => null)
    const text = String(data?.choices?.[0]?.message?.content || '').trim()
    return acceptable(text) || ( /^skip\b/i.test(text) ? null : fallbackLine(title, source) )
  } catch {
    return fallbackLine(title, source)
  }
}
