import { mkdir, readFile, stat, writeFile } from 'fs/promises'
import path from 'path'
import prisma from '@/lib/prisma'
import { deskByHandle, type Desk } from '@/lib/curator/desks'
import { keptQuotes, type KeptQuote } from '@/lib/curator/keptQuote'
import { publishKeptQuote } from '@/lib/curator/publish'

const DAY_CAP = 8
const LOOKS = 6
const FILE = path.join(process.cwd(), '.cache', 'curator', 'quote-cursor.json')
const PAUSE = path.join(process.cwd(), '.cache', 'curator', 'pause')
const PLACEHOLDER = /transcript was not included|video added to this question|open the file to read it|open the file at this address/i

interface Piece {
  url: string
  origin: 'search' | 'member'
  body: string
  image: string
  video: string
}

interface QuoteRun {
  day: string
  count: number
  after: string
  nextAt: number
  resetAt: number
  skip: string[]
}

let pulling = false

function onServer(): boolean {
  return process.env.RENDER === 'true' || Boolean(process.env.RENDER_SERVICE_ID)
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function freshRun(): QuoteRun {
  const now = Date.now()
  return { day: today(), count: 0, after: '', nextAt: 0, resetAt: now + 7 * 24 * 60 * 60 * 1000, skip: [] }
}

async function loadRun(): Promise<QuoteRun> {
  const raw = await readFile(FILE, 'utf8').catch(() => '')
  const parsed = raw ? JSON.parse(raw) as Partial<QuoteRun> : null
  const run = freshRun()
  if (!parsed || typeof parsed !== 'object') return run
  run.after = typeof parsed.after === 'string' ? parsed.after : ''
  run.nextAt = typeof parsed.nextAt === 'number' ? parsed.nextAt : 0
  run.resetAt = typeof parsed.resetAt === 'number' ? parsed.resetAt : run.resetAt
  run.skip = Array.isArray(parsed.skip) ? parsed.skip.filter((id) => typeof id === 'string').slice(-4000) : []
  if (parsed.day === run.day && typeof parsed.count === 'number') run.count = parsed.count
  if (Date.now() > run.resetAt) {
    run.skip = []
    run.resetAt = Date.now() + 7 * 24 * 60 * 60 * 1000
  }
  return run
}

async function saveRun(run: QuoteRun): Promise<void> {
  await mkdir(path.dirname(FILE), { recursive: true })
  await writeFile(FILE, JSON.stringify(run))
}

function pieces(metadata: unknown): Piece[] {
  if (!metadata || typeof metadata !== 'object') return []
  const meta = metadata as Record<string, unknown>
  const library = meta.library && typeof meta.library === 'object' ? meta.library as Record<string, unknown> : {}
  const sources = Array.isArray(meta.sources) ? meta.sources : []
  const list: Piece[] = []
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue
    const row = source as Record<string, unknown>
    const id = typeof row.id === 'string' ? row.id : ''
    const saved = typeof library[id] === 'string' ? library[id] : ''
    const body = String(saved || (typeof row.body === 'string' ? row.body : '') || (typeof row.quote === 'string' ? row.quote : ''))
    if (body.trim().length < 40 || PLACEHOLDER.test(body)) continue
    list.push({
      url: typeof row.url === 'string' ? row.url : '',
      origin: row.origin === 'member' ? 'member' : 'search',
      body,
      image: typeof row.image === 'string' ? row.image : '',
      video: typeof row.video === 'string' ? row.video : ''
    })
  }
  const spoken = meta.spoken && typeof meta.spoken === 'object' ? meta.spoken as Record<string, unknown> : {}
  for (const item of Object.values(spoken)) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    if (row.state !== 'ready' || typeof row.text !== 'string' || row.text.trim().length < 40) continue
    list.push({ url: '', origin: 'member', body: row.text, image: '', video: 'transcript' })
  }
  const rank = (piece: Piece) => {
    const url = piece.url.split('?')[0].toLowerCase()
    const held = piece.origin === 'member' && (url.startsWith('/topic-docs/') || url.endsWith('.pdf') || Boolean(piece.video) || !piece.url)
    return held ? 0 : 1
  }
  return list.sort((a, b) => rank(a) - rank(b))
}

async function nextTopic(after: string): Promise<{ id: string; patchId: string } | null> {
  const rows = await prisma.$queryRaw<Array<{ id: string; patchId: string }>>`
    SELECT id, patch_id AS "patchId"
    FROM discovered_content
    WHERE type = 'topic'
      AND id > ${after}
      AND metadata ? 'library'
    ORDER BY id
    LIMIT 1
  `
  return rows[0] || null
}

/** The line still means something said by that person. Fail closed when the check cannot be run. */
async function lineHolds(quote: KeptQuote): Promise<boolean | null> {
  const key = process.env.DEEPSEEK_API_KEY || ''
  if (!key) return null
  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'deepseek-flash',
        temperature: 0,
        max_tokens: 40,
        thinking: { type: 'disabled' },
        messages: [{
          role: 'user',
          content: `A quote card keeps one line a person said or wrote, when that line still means something on its own.
Speaker: ${quote.speaker}
Line: ${quote.sentence}

Pass only when this is that person's words, kept as a quote, and the thought still holds in another year.
A line from any year is fine when it is not tied to one news day.
Fail a news report, a caption, a score, a bill or vote summary, a headline, and page text.
Fail when the speaker did not say this line.
Reply JSON only: {"pass":true} or {"pass":false}`
        }]
      }),
      signal: AbortSignal.timeout(20000)
    })
    if (!response.ok) return null
    const data = await response.json().catch(() => null)
    const raw = String(data?.choices?.[0]?.message?.content || '')
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return null
    const pass = (JSON.parse(match[0]) as { pass?: unknown }).pass
    return pass === true ? true : pass === false ? false : null
  } catch {
    return null
  }
}

async function alreadyCard(sentence: string): Promise<boolean> {
  const prior = await prisma.post.findFirst({
    where: { content: { contains: sentence.slice(0, 140) } },
    select: { id: true }
  })
  return Boolean(prior)
}

/**
 * One quote from a question the bot already has.
 * The line is copied from the saved document, transcript, or page.
 * The card is drawn on the server. A news blurb is not a quote.
 */
export async function pullPatchQuote(): Promise<void> {
  if (!onServer() || pulling) return
  if (await stat(PAUSE).then(() => true).catch(() => false)) return
  pulling = true
  try {
    const run = await loadRun()
    const now = Date.now()
    if (run.nextAt > now) return
    if (run.count >= DAY_CAP) {
      const tomorrow = new Date()
      tomorrow.setUTCHours(24, 0, 0, 0)
      run.nextAt = tomorrow.getTime()
      await saveRun(run)
      return
    }
    const seen = new Set(run.skip)
    let after = run.after
    let wrapped = false
    for (let look = 0; look < LOOKS; look += 1) {
      const next = await nextTopic(after)
      if (!next) {
        if (wrapped) {
          run.nextAt = now + 6 * 60 * 60 * 1000
          break
        }
        wrapped = true
        after = ''
        continue
      }
      const previous = after
      after = next.id
      run.after = after
      if (seen.has(next.id)) continue
      const row = await prisma.discoveredContent.findUnique({
        where: { id: next.id },
        select: { metadata: true }
      })
      const patch = await prisma.patch.findUnique({
        where: { id: next.patchId },
        select: { handle: true }
      })
      const desk: Desk | undefined = deskByHandle(patch?.handle)
      if (!desk) {
        run.skip.push(next.id)
        continue
      }
      const candidates: Array<KeptQuote & { url: string; image: string }> = []
      for (const piece of pieces(row?.metadata)) {
        for (const quote of keptQuotes(piece.body)) {
          candidates.push({ ...quote, url: piece.url, image: piece.image })
          if (candidates.length >= 4) break
        }
        if (candidates.length >= 4) break
      }
      if (candidates.length === 0) {
        run.skip.push(next.id)
        continue
      }
      let held: (KeptQuote & { url: string; image: string }) | null = null
      let stalled = false
      for (const quote of candidates) {
        if (await alreadyCard(quote.sentence)) continue
        const verdict = await lineHolds(quote)
        if (verdict === null) {
          run.after = previous
          run.nextAt = now + 10 * 60 * 1000
          stalled = true
          break
        }
        if (verdict) {
          held = quote
          break
        }
      }
      if (stalled) break
      if (!held) {
        run.skip.push(next.id)
        continue
      }
      const posted = await publishKeptQuote(desk, held, held.url).catch(() => false)
      run.skip.push(next.id)
      run.nextAt = now + (posted ? 2 : 10) * 60 * 1000
      if (posted) {
        run.count += 1
        console.log(`[curator] quote ${desk.name} · ${held.speaker}`)
      }
      break
    }
    if (run.nextAt <= now) run.nextAt = now + 10 * 60 * 1000
    await saveRun(run)
  } catch (error) {
    console.error('[curator] quote', error instanceof Error ? error.message : error)
    const run = await loadRun().catch(() => null)
    if (run) {
      run.nextAt = Date.now() + 10 * 60 * 1000
      await saveRun(run).catch(() => undefined)
    }
  } finally {
    pulling = false
  }
}
