import path from 'path'
import { config as loadEnv } from 'dotenv'
import { PublicUrlError } from '@/lib/learn/publicUrl'

export interface StatusPhoto {
  pageUrl: string
  imageUrl: string
  caption: string
  statusId: string
}

export function statusPhotoTarget(raw: string): { user: string; id: string; photo: number } | null {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return null
  }
  const host = url.hostname.replace(/^www\./, '').toLowerCase()
  if (host !== 'x.com' && host !== 'twitter.com' && host !== 'mobile.twitter.com' && host !== 'mobile.x.com') return null
  const match = url.pathname.match(/^\/([^/]+)\/status\/(\d+)/)
  if (!match) return null
  const photo = Number(url.pathname.match(/\/photo\/(\d+)/)?.[1] || '1')
  return { user: match[1], id: match[2], photo: Number.isFinite(photo) && photo > 0 ? photo : 1 }
}

export async function lookupStatusPhoto(raw: string): Promise<StatusPhoto | null> {
  const target = statusPhotoTarget(raw)
  if (!target) return null
  const response = await fetch(`https://api.fxtwitter.com/${encodeURIComponent(target.user)}/status/${target.id}`, {
    headers: { 'User-Agent': 'CarrotLearn/1.0', Accept: 'application/json' },
    signal: AbortSignal.timeout(12_000)
  }).catch(() => null)
  if (!response?.ok) throw new PublicUrlError('That post could not be opened.')
  const data = await response.json().catch(() => null)
  const photos = Array.isArray(data?.tweet?.media?.photos) ? data.tweet.media.photos : []
  const photo = photos[target.photo - 1] || photos[0]
  if (!photo || typeof photo.url !== 'string') return null
  const pageUrl = typeof data?.tweet?.url === 'string' ? data.tweet.url : `https://x.com/${target.user}/status/${target.id}`
  const caption = typeof data?.tweet?.text === 'string' ? data.tweet.text.trim() : ''
  return { pageUrl, imageUrl: photo.url, caption, statusId: target.id }
}

function deepseekKey(): string {
  if (process.env.DEEPSEEK_API_KEY) return process.env.DEEPSEEK_API_KEY
  loadEnv({ path: path.join(process.cwd(), '.env.local') })
  return process.env.DEEPSEEK_API_KEY || ''
}

async function readWithModel(options: { question: string; caption: string; bytes: Buffer; mime: string }, key: string): Promise<string> {
  const dataUrl = `data:${options.mime};base64,${options.bytes.toString('base64')}`
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'deepseek-flash',
      temperature: 0.2,
      max_tokens: 2500,
      thinking: { type: 'disabled' },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Question:\n${options.question.slice(0, 300)}\n\nPost caption:\n${options.caption || '(none)'}\n\nRead the photograph for this question. Write three parts in plain text, with these headings and no markdown:\nTitle\nWhat the photograph shows\nWhy it matters\n\nTitle is a short name of what the item is, under 12 words. Do not start with "The photograph shows".\nWhat the photograph shows uses only what is visible and the caption. Quote the lines in the image.\nWhy it matters states the argument people make when they connect this image to the question. Follow a person or document named in the image to a later office or a second document, and say how people place the question's event in that sequence. If a line they cite is from a different document, name that document. Use the words "The argument is" so a reader can see this is the connection people draw. Do not agree with it and do not argue against it. Do not add a sentence about what the image does not prove or does not establish. If a line is unclear, say the line is unclear.`
            },
            { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } }
          ]
        }
      ]
    }),
    signal: AbortSignal.timeout(55_000)
  }).catch(() => null)
  if (!response?.ok) {
    console.error('[topic] photograph reading failed', response?.status || 'no response')
    return ''
  }
  const data = await response.json().catch(() => null)
  const text = data?.choices?.[0]?.message?.content
  return typeof text === 'string' ? text.replace(/^#{1,6}\s+/gm, '').replace(/\*\*/g, '').trim() : ''
}

function argumentOnly(text: string): string {
  const paragraphs = text.split(/\n\n/).map((paragraph) => paragraph
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => !/\b(does not establish|does not prove|does not show|do not show|do not establish|not proof|no documented link|cannot prove|it is not evidence|had any role)\b/i.test(sentence))
    .join(' ')
    .trim()).filter(Boolean)
  return paragraphs.join('\n\n').trim()
}

function capChain(text: string, max: number): string {
  const clean = text.replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max)
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('.\n'), cut.lastIndexOf('? '), cut.lastIndexOf('! '))
  return (end > 80 ? cut.slice(0, end + 1) : cut).trim()
}

function readingSection(text: string, heading: string): string {
  const match = text.match(new RegExp(`(?:^|\\n)${heading}\\s*\\n+([\\s\\S]*?)(?=\\n+(?:Title|What the photograph shows|What it is|Why it matters)\\s*\\n+|$)`, 'i'))
  return match?.[1]?.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim() || ''
}

export function splitReading(text: string): { title: string; quote: string; summary: string } {
  const title = readingSection(text, 'Title')
  const what = readingSection(text, 'What the photograph shows') || readingSection(text, 'What it is')
  const why = readingSection(text, 'Why it matters')
  const quote = [
    what ? `What it is\n\n${what}` : '',
    why ? `Why it matters\n\n${why}` : ''
  ].filter(Boolean).join('\n\n')
  return {
    title: title.slice(0, 90),
    quote: quote || text.trim(),
    summary: capChain(argumentOnly(why), 1400)
  }
}

export async function describePassage(options: { question: string; text: string; name?: string; url?: string; lookFor?: string }): Promise<{ title: string; summary: string } | null> {
  const source = options.text.trim().slice(0, 4000)
  const key = deepseekKey()
  if (!key || source.length < 40) {
    console.error('[topic] passage reading skipped', !key ? 'no key' : 'short')
    return null
  }
  const name = (options.name || '').trim().slice(0, 180)
  const url = (options.url || '').trim().slice(0, 300)
  const lookFor = (options.lookFor || '').trim().slice(0, 200)
  const label = [name && `Name: ${name}`, url && `Address: ${url}`, lookFor && `Look for:\n${lookFor}`].filter(Boolean).join('\n')
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'deepseek-flash',
      temperature: 0.2,
      max_tokens: 1400,
      thinking: { type: 'disabled' },
      messages: [
        {
          role: 'user',
          content: `Question:\n${options.question.slice(0, 300)}\n\n${label ? `${label}\n\n` : ''}Source:\n${source}\n\nWrite three parts in plain text, with these headings and no markdown:\nTitle\nWhat it is\nWhy it matters\n\nTitle is a short name of the document, under 12 words.\nWhat it is says what this source is and what it says, from the text.\nIf a Look for line is present, those are the words the person asked you to find. Build the argument from them.\nWhy it matters states the argument people make when they connect this document to the question. Four short paragraphs at most, under 1100 characters. Put the steps in order: what this document says, the people and the offices they later held, any second document the argument uses, and the event or war people place in between.
The excerpt may be only the opening. If this is a known public document, state the recommendation it is known for, including a country it names, even when that part is later in the document.
Each next paragraph is one hop you can name: a person this document names and the later public office they actually held; a second document, named by title and year.
Do not say a person wrote or signed a second document unless they are on its author or participant list. If you are not sure, say the overlap is the wider circle, not a signature.
If a famous sentence is widely attached to this document but belongs to another document, name that document and do not put the sentence here. Quote the sentence's subject in a few words, not a long extract.
If the question is about an attack, include the war people place after it, and the people from this document who were in office then.
If the second document is known for one sentence people use to tie it to the question, name the subject of that sentence in a few words and say the sentence is in that other document.
Open with "The argument people make". Do not agree with the argument and do not argue against it. Do not add any sentence about what the document does not prove, does not establish, or does not show.
If you know no argument people make, say what the document recommends and stop.`
        }
      ]
    }),
    signal: AbortSignal.timeout(30_000)
  }).catch((error: unknown) => {
    console.error('[topic] passage reading failed', error instanceof Error ? error.message : 'no response')
    return null
  })
  if (!response?.ok) {
    console.error('[topic] passage reading failed', response?.status || 'no response')
    return null
  }
  const data = await response.json().catch(() => null)
  const message = data?.choices?.[0]?.message
  const text = message?.content
  if (typeof text !== 'string' || !text.trim()) {
    const reason = typeof message?.reasoning_content === 'string' ? message.reasoning_content.length : 0
    console.error('[topic] passage reading empty', data?.choices?.[0]?.finish_reason || 'none', typeof text === 'string' ? text.length : 'missing', reason)
    return null
  }
  const parts = splitReading(text.replace(/^#{1,6}\s+/gm, '').replace(/\*\*/g, '').trim())
  if (!parts.title && !parts.summary) {
    console.error('[topic] passage reading unparsed')
    return null
  }
  return { title: parts.title, summary: parts.summary }
}

export async function explainPhotograph(options: { question: string; caption: string; bytes: Buffer; mime: string }): Promise<string> {
  const caption = options.caption.trim().slice(0, 500)
  const fallback = [
    'What the photograph shows',
    '',
    'The photograph is saved, but it could not be read.',
    '',
    'The post says',
    '',
    caption || 'The post has no caption.'
  ].join('\n')
  const key = deepseekKey()
  if (!key) {
    console.error('[topic] photograph reading failed, no model key')
    return fallback
  }
  const first = await readWithModel({ ...options, caption }, key)
  const text = first || await readWithModel({ ...options, caption }, key)
  return text || fallback
}
