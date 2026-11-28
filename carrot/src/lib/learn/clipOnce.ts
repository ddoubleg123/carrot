import { spawn } from 'child_process'
import { mkdir, readdir, readFile, writeFile } from 'fs/promises'
import path from 'path'
import { brandClip } from '@/lib/learn/brandClip'
import { localVideoJob, startLocalVideo } from '@/lib/learn/localVideo'
import { ffmpegPath } from '@/lib/mediaBins'

export interface ClipCut {
  title: string
  start: number
  end: number
  quote: string
  src: string
  note?: string
}

export interface ClipOnceJob {
  id: string
  status: 'running' | 'completed' | 'failed'
  stage: string
  detail: string
  clips: ClipCut[]
  error?: string
  masterVideo?: string
  masterCaption?: string
}

interface Line {
  start: number
  end: number
  text: string
  turn: number
}

interface Turn {
  start: number
  end: number
  lines: Line[]
}

interface Window {
  start: number
  end: number
  text: string
}

const jobs = new Map<string, ClipOnceJob>()
let latestId = ''

export function clipOnceJob(id: string): ClipOnceJob | null {
  return jobs.get(id) || null
}

export async function latestOrSaved(): Promise<ClipOnceJob | null> {
  const current = latestId ? jobs.get(latestId) || null : null
  if (current) return current
  const dir = path.join(process.cwd(), 'public', 'topic-videos', 'clips')
  const files = (await readdir(dir).catch(() => [] as string[])).filter((file) => file.endsWith('.json')).sort()
  const newest = files.at(-1)
  if (!newest) return null
  return loadClipJob(newest.replace(/\.json$/, ''))
}

function stamp(value: string): number {
  const parts = value.split(':').map(Number)
  if (parts.some((part) => Number.isNaN(part))) return 0
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  return parts[0] * 60 + parts[1]
}

export function timedLines(raw: string): Line[] {
  const lines: Line[] = []
  let turn = 0
  let open = ''
  for (const cue of raw.replace(/^\uFEFF/, '').split(/\n\s*\n/)) {
    const match = cue.match(/((?:\d{2}:)?\d{2}:\d{2}\.\d{3})\s+-->\s+((?:\d{2}:)?\d{2}:\d{2}\.\d{3})/)
    if (!match) continue
    const parsed = cueText(cue.split(/\n/).slice(1).join(' '))
    if (parsed.mark) {
      const same = open.length > 0 && (parsed.speech.startsWith(open.slice(0, 24)) || open.startsWith(parsed.speech.slice(0, 24)))
      if (!same) turn += 1
      if (!same || parsed.speech.length >= open.length) open = parsed.speech
    }
    if (parsed.text.length < 2 || /^\[(music|applause|laughter)\]$/i.test(parsed.text)) continue
    const start = stamp(match[1])
    const end = stamp(match[2])
    if (end <= start) continue
    lines.push({ start, end, text: parsed.text, turn })
  }
  const kept: Line[] = []
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const next = lines[index + 1]
    const head = line.text.slice(0, Math.min(line.text.length, 48))
    if (next && next.turn === line.turn && !next.text.startsWith(head)) continue
    const previous = kept[kept.length - 1]
    if (previous && previous.turn === line.turn && (line.text === previous.text || line.text.startsWith(previous.text.slice(0, Math.min(previous.text.length, 48))))) continue
    kept.push(line)
  }
  return splitSentences(kept)
}

function splitSentences(lines: Line[]): Line[] {
  const out: Line[] = []
  for (const line of lines) {
    const parts = sentenceParts(line.text)
    if (parts.length <= 1) {
      out.push(line)
      continue
    }
    const span = Math.max(0.05, line.end - line.start)
    let cursor = 0
    for (const part of parts) {
      const at = line.text.indexOf(part, cursor)
      const from = at < 0 ? cursor : at
      const to = from + part.length
      const start = line.start + (from / line.text.length) * span
      const end = Math.max(start + 0.05, line.start + (to / line.text.length) * span)
      out.push({ start, end, text: part, turn: line.turn })
      cursor = to
    }
  }
  return out
}

function sentenceParts(text: string): string[] {
  const masked = text.replace(/\b(?:Mr|Mrs|Ms|Dr|St|Sen|Rep|Jr|Sr|Gen|Col|Sgt|Prof|vs|etc|U\.S(?:\.A)?)\./gi, (token) => token.replace(/\./g, '\u0001'))
  return masked
    .split(/(?<=[.!?]["']?)\s+(?=[A-Z"“'(])/)
    .map((part) => part.replace(/\u0001/g, '.').trim())
    .filter((part) => part.length > 1)
}

function cueText(raw: string): { text: string; speech: string; mark: boolean } {
  const decoded = raw
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, value) => String.fromCharCode(Number(value)))
    .replace(/&#x([0-9a-f]+);/gi, (_, value) => String.fromCharCode(parseInt(value, 16)))
  const mark = /(^|\s)>{2,}/.test(decoded)
  const text = decoded.replace(/>{2,}/g, ' ').replace(/\s+/g, ' ').trim()
  const speech = (mark ? decoded.split(/>{2,}/).pop() || '' : text).replace(/\s+/g, ' ').trim()
  return { text, speech, mark }
}

function hanging(text: string): boolean {
  const cleaned = text.trim()
  if (/[?]["']?$/.test(cleaned)) return true
  const last = cleaned.split(/\s+/).at(-1)?.toLowerCase().replace(/[^a-z']/g, '') || ''
  return ['and', 'but', 'or', 'so', 'because', 'now', 'that', 'which', 'who', 'if', 'when', 'with', 'to', 'of', 'the', 'a', 'an', 'our', 'your', 'their', 'its', 'my'].includes(last)
}

function captionFile(files: string[], base: string): string | undefined {
  const matches = files.filter((file) => file.startsWith(`${base}.`) && file.toLowerCase().endsWith('.vtt'))
  return matches.find((file) => file.toLowerCase().includes('orig'))
    || matches.find((file) => file.toLowerCase().endsWith('.en.vtt'))
    || matches[0]
}

function asks(text: string): boolean {
  return text.includes('?') || /your reaction|\breaction\b|let'?s see|short video|\bvideo\b|let me play|watch this|show you|what do you|why do you|how do you|will you|are you going to/i.test(text)
}

function wantsPlayedClip(text: string): boolean {
  return /your reaction|\breaction\b|let'?s see|short video|\bvideo\b|let me play|watch this|show you/i.test(text)
}

function owesReply(text: string): boolean {
  return wantsPlayedClip(text) || /\?["']?\s*$/.test(text.trim())
}

function hasReply(chunks: string[]): boolean {
  const requestAt = chunks.findIndex((chunk) => asks(chunk) || wantsPlayedClip(chunk))
  if (requestAt < 0) return true
  return chunks.slice(requestAt + 1).join(' ').split(/\s+/).filter(Boolean).length >= 20
}

function turnText(turn: Turn): string {
  return joinSpeech(turn.lines.map((line) => line.text))
}

function turnsOf(lines: Line[]): Turn[] {
  const turns: Turn[] = []
  for (const line of lines) {
    const last = turns[turns.length - 1]
    if (!last || last.lines[0].turn !== line.turn) turns.push({ start: line.start, end: line.end, lines: [line] })
    else {
      last.end = line.end
      last.lines.push(line)
    }
  }
  return turns
}

function land(turn: Turn, maxSeconds: number): { end: number; text: string } {
  const parts: string[] = []
  let end = turn.start
  for (const line of turn.lines) {
    if (parts.length > 0 && line.start - turn.start >= maxSeconds && end - turn.start >= 15) break
    parts.push(line.text)
    end = line.end
    const text = joinSpeech(parts)
    if (end - turn.start >= 18 && text.split(/\s+/).length >= 18 && !hanging(text) && /[.!]["']?\s*$/.test(text)) return { end, text }
  }
  return { end, text: joinSpeech(parts) }
}

function joinSpeech(parts: string[]): string {
  let spoken = ''
  for (const part of parts) {
    const next = part.trim()
    if (!next) continue
    if (!spoken) {
      spoken = next
      continue
    }
    if (spoken.endsWith(next) || spoken.includes(next)) continue
    let cut = 0
    const limit = Math.min(spoken.length, next.length)
    for (let size = limit; size >= 12; size -= 1) {
      if (spoken.slice(-size) === next.slice(0, size)) {
        cut = size
        break
      }
    }
    spoken = cut > 0 ? `${spoken}${next.slice(cut)}` : `${spoken} ${next}`
  }
  return spoken.replace(/\s+/g, ' ').trim()
}

function closed(text: string): boolean {
  const cleaned = text.trim()
  if (!cleaned || hanging(cleaned)) return false
  return /[.!]["']?\s*$/.test(cleaned)
}

function lastChunk(text: string): string {
  return text.split('\n\n').at(-1) || text
}

function endsOnQuestion(text: string): boolean {
  return /\?["']?\s*$/.test(lastChunk(text).trim())
}

function quoteBetween(lines: Line[], start: number, end: number): string {
  const chunks: string[] = []
  let turn = -1
  let parts: string[] = []
  const flush = () => {
    if (parts.length) chunks.push(joinSpeech(parts))
    parts = []
  }
  for (const line of lines) {
    if (line.end <= start + 0.15 || line.end > end + 0.08) continue
    if (line.turn !== turn) {
      flush()
      turn = line.turn
    }
    parts.push(line.text)
  }
  flush()
  return chunks.join('\n\n')
}

function sentenceEnds(lines: Line[], start: number, until: number): number[] {
  const ends: number[] = []
  let turn = -1
  let parts: string[] = []
  for (const line of lines) {
    if (line.end < start || line.start > until) continue
    if (line.turn !== turn) {
      parts = []
      turn = line.turn
    }
    parts.push(line.text)
    if (closed(joinSpeech(parts))) ends.push(line.end)
  }
  return ends
}

function seal(lines: Line[], start: number, end: number): { end: number; text: string; moved: boolean } {
  const now = quoteBetween(lines, start, end)
  if (closed(lastChunk(now))) return { end, text: now, moved: false }
  const tail = lines.filter((line) => line.start >= end - 0.4 && line.start <= end + 35)
  let cursor = end
  let text = now
  const turn = tail.find((line) => line.start >= end - 0.4)?.turn
  for (const line of tail) {
    if (turn !== undefined && line.turn !== turn && closed(lastChunk(text))) break
    cursor = Math.max(cursor, line.end)
    text = quoteBetween(lines, start, cursor)
    if (closed(lastChunk(text))) return { end: cursor, text, moved: true }
  }
  const back = sentenceEnds(lines, start, end).filter((at) => at - start >= 18).at(-1)
  if (back) return { end: back, text: quoteBetween(lines, start, back), moved: true }
  return { end: cursor, text, moved: cursor !== end }
}

function windows(lines: Line[]): Window[] {
  const turns = turnsOf(lines)
  const built: Window[] = []
  let index = 0
  while (index < turns.length) {
    const opening = turns[index]
    const openingText = turnText(opening)
    if (openingText.split(/\s+/).length < 10) {
      index += 1
      continue
    }
    const question = asks(openingText) || wantsPlayedClip(openingText)
    const chunks = [openingText]
    let end = opening.end
    let next = index
    let owed = question
    while (next + 1 < turns.length && end - opening.start < 110 && (owed || end - opening.start < 60)) {
      next += 1
      const follow = turns[next]
      const followText = turnText(follow)
      const waitingOnClip = owed && chunks.some((chunk) => wantsPlayedClip(chunk))
      const playedClip = waitingOnClip && follow.end - follow.start <= 45 && !asks(followText)
      const room = Math.max(20, 100 - (follow.start - opening.start))
      const slice = playedClip || follow.end - follow.start <= room ? { end: follow.end, text: followText } : land(follow, Math.min(50, room))
      chunks.push(slice.text)
      end = slice.end
      if (playedClip) owed = true
      else owed = owesReply(slice.text)
      if (!owed && end - opening.start >= 60 && !hanging(slice.text)) break
    }
    const sealed = seal(lines, opening.start, end)
    const duration = sealed.end - opening.start
    const spoken = sealed.text
    const lastWords = lastChunk(spoken).split(/\s+/).filter(Boolean).length
    if (duration >= 45 && duration <= 120 && spoken.length > 80 && hasReply(spoken.split('\n\n')) && lastWords >= 20 && closed(lastChunk(spoken)) && !/^because\b/i.test(openingText)) {
      built.push({ start: opening.start, end: sealed.end, text: spoken.slice(0, 4000) })
    }
    index = Math.max(index + 1, next)
  }
  const whole = built.filter((item, index) => !built.some((other, otherIndex) => otherIndex !== index && other.start <= item.start + 1 && other.end >= item.end - 1 && other.end - other.start > item.end - item.start + 8))
  const exchanges = whole.filter((item) => item.text.includes('\n\n'))
  const pool = exchanges.length >= 3 ? exchanges : whole
  if (pool.length <= 36) return pool
  const picked: Window[] = []
  for (let step = 0; step < 36; step += 1) {
    picked.push(pool[Math.floor((step * (pool.length - 1)) / 35)])
  }
  return picked
}

function fallback(choices: Window[]): Window[] {
  if (choices.length === 0) return []
  const spots = [0.2, 0.5, 0.8].map((spot) => choices[Math.min(choices.length - 1, Math.floor(spot * choices.length))])
  const unique: Window[] = []
  for (const window of spots) {
    if (!unique.some((item) => item.start === window.start)) unique.push(window)
  }
  return unique.slice(0, 3)
}

async function askModel(choices: Window[]): Promise<Window[] | null> {
  const key = process.env.DEEPSEEK_API_KEY || ''
  if (!key) return null
  const list = choices.map((window, index) => {
    const preview = window.text.length <= 360 ? window.text : `${window.text.slice(0, 220)} … ${window.text.slice(-120)}`
    return `${index}. [${Math.round(window.start)}-${Math.round(window.end)}] ${preview}`
  }).join('\n')
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'deepseek-flash',
      temperature: 0.2,
      max_tokens: 500,
      thinking: { type: 'disabled' },
      messages: [{
        role: 'user',
        content: `Pick 3 exchanges a person would stop scrolling for. Each numbered window is one exchange. When it contains a question, the answer is already in that same window, after the break. Prefer those. Do not pick a window that is only the question. Reply with JSON only: [{"index":0,"title":"short title"}].\n\n${list}`
      }]
    }),
    signal: AbortSignal.timeout(30000)
  }).catch(() => null)
  if (!response?.ok) return null
  const data = await response.json().catch(() => null)
  const text = String(data?.choices?.[0]?.message?.content || '')
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) return null
  const parsed = JSON.parse(match[0]) as Array<{ index?: number; title?: string }>
  if (!Array.isArray(parsed)) return null
  const chosen: Array<Window & { title?: string }> = []
  for (const item of parsed) {
    const window = choices[Number(item.index)]
    if (!window || chosen.some((have) => have.start === window.start)) continue
    const title = typeof item.title === 'string' ? item.title.trim().slice(0, 80) : ''
    chosen.push(title ? { ...window, title } : window)
    if (chosen.length === 3) break
  }
  return chosen.length ? chosen : null
}

function brokenStart(text: string): boolean {
  const cleaned = text.trim()
  if (/^(and|but|because|second|delineate|question|uh|um)\b/i.test(cleaned)) return true
  const letter = cleaned.match(/[A-Za-z]/)
  if (letter && letter[0] === letter[0].toLowerCase()) return true
  const rest = cleaned.replace(/^(?:(?:Mr|Mrs|Ms|Miss|Dr)\.?\s+)?[A-Z][A-Za-z'’-]{2,},\s+/, '')
  return rest !== cleaned && /^(because|since|although|though|while|if|when|which|who|that)\b/i.test(rest)
}

function nudge(lines: Line[], start: number, end: number, move: 'extend' | 'shorten' | 'trim'): { start: number; end: number; text: string } | null {
  if (move === 'trim') {
    const earlier = sentenceEnds(lines, Math.max(0, start - 25), start).reverse()
    for (const mark of earlier) {
      if (mark >= start - 0.15) continue
      const text = quoteBetween(lines, mark, end)
      if (text.length > 40 && !brokenStart(text) && closed(lastChunk(text))) return { start: mark, end, text }
    }
    const marks = sentenceEnds(lines, start, Math.min(end, start + 40))
    for (const mark of marks) {
      if (mark <= start + 0.15 || mark >= end - 12) continue
      const text = quoteBetween(lines, mark, end)
      if (text.length > 40 && !brokenStart(text)) return { start: mark, end, text }
    }
    return null
  }
  const marks = sentenceEnds(lines, start, end + (move === 'extend' ? 45 : 0))
  const options = move === 'extend'
    ? marks.filter((mark) => mark > end + 0.4)
    : marks.filter((mark) => mark < end - 2 && mark - start >= 15).reverse()
  for (const mark of options) {
    const text = quoteBetween(lines, start, mark)
    if (closed(lastChunk(text)) && !brokenStart(text)) return { start, end: mark, text }
  }
  return null
}

async function judgeClip(text: string): Promise<{ ok: boolean; move?: 'extend' | 'shorten' | 'trim' }> {
  if (brokenStart(text)) return { ok: false, move: 'trim' }
  if (!closed(lastChunk(text))) return { ok: false, move: 'extend' }
  const key = process.env.DEEPSEEK_API_KEY || ''
  if (!key) return { ok: closed(lastChunk(text)) && !brokenStart(text) }
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'deepseek-flash',
      temperature: 0,
      max_tokens: 120,
      thinking: { type: 'disabled' },
      messages: [{
        role: 'user',
        content: `You are the QA check for one video clip. Speakers are separated by a blank line. Pass only if the clip starts at the beginning of a sentence, ends at the end of a sentence, and any question in it is answered before the clip ends. Fail if it ends by opening a new question. If it fails, pick one repair: trim drops a broken opening, extend keeps going to finish the answer, shorten stops before a new question. Reply JSON only: {"ok":true} or {"ok":false,"move":"trim"|"extend"|"shorten"}\n\n${text.slice(0, 2500)}`
      }]
    }),
    signal: AbortSignal.timeout(30000)
  }).catch(() => null)
  if (!response?.ok) return { ok: closed(lastChunk(text)) && !brokenStart(text) && !endsOnQuestion(text) }
  const data = await response.json().catch(() => null)
  const raw = String(data?.choices?.[0]?.message?.content || '')
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) return { ok: closed(lastChunk(text)) && !brokenStart(text) && !endsOnQuestion(text) }
  const parsed = JSON.parse(match[0]) as { ok?: boolean; move?: string }
  if (parsed.ok === true) return { ok: true }
  const move = parsed.move === 'trim' || parsed.move === 'shorten' || parsed.move === 'extend' ? parsed.move : 'extend'
  return { ok: false, move }
}

function runFile(binary: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { windowsHide: true })
    let errors = ''
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error('The cut took too long.'))
    }, 180000)
    child.stderr.on('data', (chunk) => {
      errors = (errors + String(chunk)).slice(-400)
    })
    child.on('error', () => {
      clearTimeout(timer)
      reject(new Error('ffmpeg did not start.'))
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) resolve()
      else reject(new Error(errors || 'The clip could not be cut.'))
    })
  })
}

async function cutClip(ffmpeg: string, video: string, file: string, start: number, end: number, pageUrl: string) {
  const at = Math.max(0, start - 0.12)
  const stop = end + 0.55
  const coarse = Math.max(0, at - 3)
  await runFile(ffmpeg, [
    '-y',
    '-ss', coarse.toFixed(2),
    '-i', video,
    '-ss', (at - coarse).toFixed(2),
    '-t', Math.max(8, stop - at).toFixed(2),
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '23',
    '-c:a', 'aac',
    '-movflags', '+faststart',
    file
  ])
  await brandClip(ffmpeg, file, pageUrl)
}

function clipFile(job: ClipOnceJob, index: number): string {
  return path.join(process.cwd(), 'public', 'topic-videos', 'clips', `${job.id}-${index + 1}.mp4`)
}

async function remember(job: ClipOnceJob) {
  const dir = path.join(process.cwd(), 'public', 'topic-videos', 'clips')
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, `${job.id}.json`), JSON.stringify({
    id: job.id,
    masterVideo: job.masterVideo,
    masterCaption: job.masterCaption,
    clips: job.clips
  }))
}

export async function loadClipJob(id: string): Promise<ClipOnceJob | null> {
  const saved = jobs.get(id)
  if (saved) return saved
  const file = path.join(process.cwd(), 'public', 'topic-videos', 'clips', `${id}.json`)
  const raw = await readFile(file, 'utf8').catch(() => '')
  if (!raw) return null
  const parsed = JSON.parse(raw) as { id: string; masterVideo?: string; masterCaption?: string; clips: ClipCut[] }
  const job: ClipOnceJob = {
    id: parsed.id,
    status: 'completed',
    stage: 'Done',
    detail: `${parsed.clips.length} clips are ready.`,
    clips: parsed.clips,
    masterVideo: parsed.masterVideo,
    masterCaption: parsed.masterCaption
  }
  jobs.set(job.id, job)
  latestId = job.id
  return job
}

export async function adjustClip(id: string, index: number, direction: 'extend' | 'shorten'): Promise<ClipOnceJob> {
  const job = await loadClipJob(id)
  const clip = job?.clips[index]
  if (!job || !clip || !job.masterVideo || !job.masterCaption) throw new Error('That clip can no longer be adjusted.')
  const lines = timedLines(await readFile(job.masterCaption, 'utf8'))
  const ends = sentenceEnds(lines, clip.start, clip.end + 45)
  const candidates = direction === 'extend'
    ? ends.filter((at) => at > clip.end + 0.4)
    : ends.filter((at) => at < clip.end - 2 && at - clip.start >= 15).reverse()
  let picked: { at: number; text: string } | null = null
  for (const at of candidates) {
    const text = quoteBetween(lines, clip.start, at)
    if (closed(lastChunk(text))) {
      picked = { at, text }
      break
    }
  }
  if (!picked) throw new Error(direction === 'extend' ? 'The next finished sentence is too far.' : 'There is no shorter finished ending.')
  const ffmpeg = await ffmpegPath()
  if (!ffmpeg) throw new Error('ffmpeg is not installed on this machine.')
  await cutClip(ffmpeg, job.masterVideo, clipFile(job, index), clip.start, picked.at, 'https://gotcarrot.com')
  clip.end = picked.at
  clip.quote = picked.text.slice(0, 6000)
  clip.note = direction === 'extend' ? 'Extended to the next finished sentence.' : 'Shortened to the previous finished sentence.'
  clip.src = `/topic-videos/clips/${job.id}-${index + 1}.mp4?v=${Date.now()}`
  job.clips = [...job.clips]
  await remember(job)
  return job
}

async function savedMaster(): Promise<{ video: string; caption: string } | null> {
  const dir = path.join(process.cwd(), 'public', 'topic-videos')
  const files = await readdir(dir).catch(() => [] as string[])
  const videos = files.filter((file) => file.toLowerCase().endsWith('.mp4') && !file.startsWith('clip-')).sort().reverse()
  for (const video of videos) {
    const base = video.slice(0, -4)
    const caption = captionFile(files, base)
    if (caption) return { video: path.join(dir, video), caption: path.join(dir, caption) }
  }
  return null
}

async function waitForCopy(id: string, clip: ClipOnceJob): Promise<{ video: string; caption: string }> {
  const dir = path.join(process.cwd(), 'public', 'topic-videos')
  for (let attempt = 0; attempt < 300; attempt += 1) {
    const job = localVideoJob(id)
    if (job?.status === 'failed') throw new Error(job.error || 'The copy failed.')
    if (job && job.status === 'running' && job.progress > 5) {
      clip.detail = job.progress >= 96 ? 'The video is saved. Reading captions.' : `Saving a copy. ${job.progress}% done.`
    }
    if (job?.status === 'completed' && job.videoUrl) {
      const video = path.join(dir, path.basename(job.videoUrl))
      const files = await readdir(dir).catch(() => [] as string[])
      const caption = captionFile(files, id)
      if (!caption) throw new Error('YouTube did not return timed captions. Wait a minute and run the link again.')
      return { video, caption: path.join(dir, caption) }
    }
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }
  throw new Error('Saving the copy took too long.')
}

function digest(lines: Line[]): string {
  if (lines.length === 0) return ''
  const end = lines[lines.length - 1].end || 1
  const step = Math.max(15, end / 80)
  const rows: string[] = []
  let nextAt = 0
  for (const line of lines) {
    if (line.start < nextAt) continue
    rows.push(`[${Math.round(line.start)}] ${line.text.slice(0, 160)}`)
    nextAt = line.start + step
  }
  return rows.join('\n').slice(0, 9000)
}

async function scoutMoments(lines: Line[]): Promise<Array<{ start: number; end: number }>> {
  const key = process.env.DEEPSEEK_API_KEY || ''
  const text = digest(lines)
  if (!key || text.length < 200) return []
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'deepseek-flash',
      temperature: 0.2,
      max_tokens: 500,
      thinking: { type: 'disabled' },
      messages: [{
        role: 'user',
        content: `Read this whole talk. The numbers in brackets are seconds. Find up to 5 stretches a person would send to a friend. Each stretch needs a hook, one concrete detail, and a finished point. Skip introductions, sponsorships, and a question that never gets an answer. Each stretch should run 50 to 90 seconds and include the setup and the payoff, not only the punch line. Reply JSON only: [{"start":120,"end":185}]\n\n${text}`
      }]
    }),
    signal: AbortSignal.timeout(30000)
  }).catch(() => null)
  if (!response?.ok) return []
  const data = await response.json().catch(() => null)
  const raw = String(data?.choices?.[0]?.message?.content || '')
  const match = raw.match(/\[[\s\S]*\]/)
  if (!match) return []
  let parsed: Array<{ start?: number; end?: number }>
  try {
    parsed = JSON.parse(match[0]) as Array<{ start?: number; end?: number }>
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []
  return parsed.flatMap((item) => {
    const start = Number(item.start)
    const end = Number(item.end)
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return []
    return [{ start, end }]
  }).slice(0, 5)
}

function momentFromScout(lines: Line[], start: number, end: number): Window | null {
  const index = lines.findIndex((line) => line.end > start)
  if (index < 0) return null
  let openAt = index
  for (let cursor = index; cursor > 0; cursor -= 1) {
    const previous = lines[cursor - 1]
    if (previous.end < lines[openAt].start - 25) break
    if (closed(previous.text)) break
    openAt = cursor - 1
  }
  const open = lines[openAt].start
  const target = Math.min(Math.max(end, open + 60), open + 100)
  const sealed = seal(lines, open, target)
  const duration = sealed.end - open
  if (duration < 45 || duration > 120) return null
  if (!closed(lastChunk(sealed.text)) || brokenStart(sealed.text) || endsOnQuestion(sealed.text)) return null
  if (sealed.text.split(/\s+/).filter(Boolean).length < 90) return null
  return { start: open, end: sealed.end, text: sealed.text.slice(0, 4000) }
}

async function gradeClip(text: string): Promise<{ pass: boolean; score: number; why: string }> {
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length < 90 || brokenStart(text) || !closed(lastChunk(text)) || endsOnQuestion(text)) {
    return { pass: false, score: 0, why: 'The moment is too thin to stand on its own.' }
  }
  const key = process.env.DEEPSEEK_API_KEY || ''
  if (!key) return { pass: false, score: 0, why: 'The quality check could not run.' }
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'deepseek-flash',
      temperature: 0,
      max_tokens: 160,
      thinking: { type: 'disabled' },
      messages: [{
        role: 'user',
        content: `You are the QA agent for one clip that will be posted. Pass only if a person would send it to a friend. That means all of these: the opening is a point, not hello or throat-clearing; there is one concrete detail a listener could repeat; the ending lands that point; the clip is specific, not a fragment and not only a question. Do not reward outrage. Reward a complete, specific moment. Reply JSON only: {"pass":true,"score":8} or {"pass":false,"score":3,"why":"short reason"}\n\n${text.slice(0, 2500)}`
      }]
    }),
    signal: AbortSignal.timeout(30000)
  }).catch(() => null)
  if (!response?.ok) return { pass: false, score: 0, why: 'The quality check did not answer.' }
  const data = await response.json().catch(() => null)
  const raw = String(data?.choices?.[0]?.message?.content || '')
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) return { pass: false, score: 0, why: 'The quality check did not answer.' }
  let parsed: { pass?: boolean; score?: number; why?: string }
  try {
    parsed = JSON.parse(match[0]) as { pass?: boolean; score?: number; why?: string }
  } catch {
    return { pass: false, score: 0, why: 'The quality check did not answer.' }
  }
  const score = Number(parsed.score)
  const safeScore = Number.isFinite(score) ? score : 0
  const why = typeof parsed.why === 'string' ? parsed.why.trim().slice(0, 140) : ''
  return { pass: parsed.pass === true && safeScore >= 7, score: safeScore, why }
}

export async function startClipOnce(input: { url?: string; useSaved?: boolean; pageUrl?: string }): Promise<ClipOnceJob> {
  const id = `clip-${Date.now().toString(36)}`
  const job: ClipOnceJob = { id, status: 'running', stage: 'Starting', detail: 'The bot is taking one video.', clips: [] }
  jobs.set(id, job)
  latestId = id
  void runClipOnce(job, input).catch((error) => {
    job.status = 'failed'
    job.stage = 'Stopped'
    job.error = error instanceof Error ? error.message : 'The bot stopped.'
    job.detail = job.error
  })
  return job
}

async function runClipOnce(job: ClipOnceJob, input: { url?: string; useSaved?: boolean; pageUrl?: string }) {
  let master: { video: string; caption: string }
  if (input.useSaved) {
    job.stage = 'Copy'
    job.detail = 'Using the video copy already saved on this machine.'
    const found = await savedMaster()
    if (!found) throw new Error('There is no saved video with captions on this machine.')
    master = found
  } else {
    job.stage = 'Copy'
    job.detail = 'Saving a copy of the video.'
    const started = await startLocalVideo(input.url || '', { maxHeight: 480 })
    if (!started.id) throw new Error(started.error || 'The copy did not start.')
    job.detail = 'Saving a copy. This can take a few minutes.'
    master = await waitForCopy(started.id, job)
  }
  job.stage = 'Captions'
  job.detail = 'Reading the timed captions.'
  const lines = timedLines(await readFile(master.caption, 'utf8'))
  if (lines.length < 4) throw new Error('The captions do not have enough timed lines.')
  job.stage = 'Scanning'
  job.detail = 'Reading the whole talk for the moments worth keeping.'
  const scouted = (await scoutMoments(lines).catch(() => [])).flatMap((range) => {
    const moment = momentFromScout(lines, range.start, range.end)
    return moment ? [moment] : []
  })
  const choices = windows(lines)
  const ranked = [...scouted]
  for (const choice of choices) {
    if (!ranked.some((have) => Math.abs(have.start - choice.start) < 8)) ranked.push(choice)
  }
  if (ranked.length === 0) throw new Error('No complete moment could be formed from this talk.')
  job.stage = 'Picking'
  job.detail = `${ranked.length} moments are on the table. Grading the strongest.`
  const picked = scouted.length ? ranked.slice(0, 8) : ((await askModel(ranked).catch(() => null)) || fallback(ranked))
  const chosen = picked.length ? picked : ranked.slice(0, 8)
  const titled = chosen.map((window) => {
    const sealed = seal(lines, window.start, window.end)
    const title = (window as Window & { title?: string }).title || sealed.text.split(/\s+/).slice(0, 8).join(' ')
    return { ...window, ...sealed, title }
  })
  job.stage = 'Checking'
  job.detail = 'A check is reading each clip and fixing the cut.'
  job.masterVideo = master.video
  job.masterCaption = master.caption
  const ffmpeg = await ffmpegPath()
  if (!ffmpeg) throw new Error('ffmpeg is not installed on this machine.')
  const dir = path.join(process.cwd(), 'public', 'topic-videos', 'clips')
  await mkdir(dir, { recursive: true })
  const clips: Array<ClipCut & { score: number }> = []
  const rejected: string[] = []
  for (const window of titled) {
    let start = window.start
    let end = window.end
    let text = window.text
    let passed = false
    const seen = new Set<string>()
    const trace: string[] = []
    for (let attempt = 0; attempt < 4; attempt += 1) {
      job.detail = `Checking clip ${clips.length + 1}.`
      const key = `${start.toFixed(2)}-${end.toFixed(2)}`
      if (seen.has(key)) break
      seen.add(key)
      const verdict = await judgeClip(text)
      trace.push(verdict.ok ? 'ok' : (verdict.move || 'no'))
      if (verdict.ok) {
        passed = true
        break
      }
      if (attempt === 3) break
      const moved = nudge(lines, start, end, verdict.move || 'extend')
      if (!moved || (moved.start === start && moved.end === end)) break
      start = moved.start
      end = moved.end
      text = moved.text
    }
    if (!passed || !closed(lastChunk(text)) || brokenStart(text) || endsOnQuestion(text)) {
      rejected.push(`${Math.round(window.start)}:${trace.join('>')}`)
      continue
    }
    job.detail = `Grading the moment at ${Math.round(start)} seconds.`
    const grade = await gradeClip(text)
    if (!grade.pass) {
      rejected.push(`${Math.round(start)}:${grade.why || 'not worth posting'}`)
      continue
    }
    const file = `${job.id}-${clips.length + 1}.mp4`
    job.detail = `Cutting clip ${clips.length + 1}.`
    await cutClip(ffmpeg, master.video, path.join(dir, file), start, end, input.pageUrl || 'https://gotcarrot.com')
    clips.push({
      title: window.title,
      start,
      end,
      quote: text.slice(0, 6000),
      src: `/topic-videos/clips/${file}`,
      note: grade.why || 'QA passed',
      score: grade.score
    })
    clips.sort((left, right) => right.score - left.score)
    job.clips = clips.map(({ score, ...clip }) => {
      void score
      return clip
    })
    if (clips.length >= 3) break
  }
  if (clips.length === 0) throw new Error(`The quality check rejected every moment. ${rejected.join(' | ')}`)
  await remember(job)
  job.status = 'completed'
  job.stage = 'Done'
  job.detail = `${clips.length} clips are ready.`
}
