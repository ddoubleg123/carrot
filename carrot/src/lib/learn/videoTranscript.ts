import { createHash } from 'crypto'
import { createWriteStream } from 'fs'
import { mkdtemp, readdir, readFile, rm, stat } from 'fs/promises'
import os from 'os'
import path from 'path'
import { Readable, Transform } from 'stream'
import { pipeline } from 'stream/promises'
import { transcribeWholeFile } from '@/lib/asr/localVosk'
import { readTopicSpoken, saveTopicSpoken, type TopicSpoken } from '@/lib/learn/topic'

const MAX_BYTES = 250 * 1024 * 1024
const FAIL_AGAIN_MS = 10 * 60 * 1000
const running = new Set<string>()
let queue: Promise<void> = Promise.resolve()

export interface SpokenView {
  state: TopicSpoken['state']
  text: string
}

function videoKey(raw: string): { key: string; localName: string | null; remote: URL | null } | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('/topic-videos/')) {
    const name = trimmed.slice('/topic-videos/'.length)
    if (!/^[\w.-]+\.mp4$/i.test(name)) return null
    return { key: digest(`local:${name.toLowerCase()}`), localName: name, remote: null }
  }
  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'https:' || url.hostname !== 'video.twimg.com') return null
    return { key: digest(`twimg:${url.pathname}`), localName: null, remote: url }
  } catch {
    return null
  }
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 24)
}

function enqueue(work: () => Promise<void>) {
  const run = queue.then(work, work)
  queue = run.then(() => undefined, () => undefined)
}

export async function ensureVideoTranscript(patchId: string, topicId: string, rawUrl: string): Promise<SpokenView | null> {
  const video = videoKey(rawUrl)
  if (!video) return null
  const current = await readTopicSpoken(patchId, topicId, video.key)
  if (!current.found) return null
  const jobKey = `${topicId}:${video.key}`
  if (current.entry && (current.entry.state === 'ready' || current.entry.state === 'silent')) {
    return { state: current.entry.state, text: current.entry.text }
  }
  if (current.entry?.state === 'failed') {
    const at = Date.parse(current.entry.at)
    if (Number.isFinite(at) && Date.now() - at < FAIL_AGAIN_MS) return { state: 'failed', text: '' }
  }
  if (running.has(jobKey)) return { state: 'pending', text: '' }
  running.add(jobKey)
  const at = new Date().toISOString()
  try {
    await saveTopicSpoken(patchId, topicId, video.key, { state: 'pending', text: '', at })
  } catch (error) {
    running.delete(jobKey)
    throw error
  }
  enqueue(async () => {
    try {
      const text = await capture(video)
      const state = text.length >= 8 ? 'ready' : 'silent'
      await saveTopicSpoken(patchId, topicId, video.key, { state, text, at: new Date().toISOString() })
      console.log(`[topic transcript] ${state} ${video.key} ${text.length} chars`)
    } catch (error) {
      await saveTopicSpoken(patchId, topicId, video.key, { state: 'failed', text: '', at: new Date().toISOString() })
      console.error('[topic transcript] failed', video.key, error instanceof Error ? error.message : error)
    } finally {
      running.delete(jobKey)
    }
  })
  return { state: 'pending', text: '' }
}

export async function videoTranscript(patchId: string, topicId: string, rawUrl: string): Promise<SpokenView | null> {
  const video = videoKey(rawUrl)
  if (!video) return null
  const current = await readTopicSpoken(patchId, topicId, video.key)
  if (!current.found) return null
  if (!current.entry) return { state: 'pending', text: '' }
  if (current.entry.state === 'pending' && !running.has(`${topicId}:${video.key}`)) {
    return ensureVideoTranscript(patchId, topicId, rawUrl)
  }
  return { state: current.entry.state, text: current.entry.state === 'ready' ? current.entry.text : '' }
}

async function capture(video: { localName: string | null; remote: URL | null }): Promise<string> {
  if (video.localName) {
    const file = path.join(process.cwd(), 'public', 'topic-videos', video.localName)
    const info = await stat(file).catch(() => null)
    if (!info?.isFile()) throw new Error('The saved video is not on this machine.')
    const caption = await publishedCaption(file)
    if (caption) return caption
    const spoken = await transcribeWholeFile(file)
    return spoken.silent ? '' : spoken.text.trim()
  }
  if (!video.remote) throw new Error('That video is not available.')
  const dir = await mkdtemp(path.join(os.tmpdir(), 'carrot-topic-asr-'))
  const file = path.join(dir, 'video.mp4')
  try {
    await downloadVideo(video.remote, file)
    const spoken = await transcribeWholeFile(file)
    return spoken.silent ? '' : spoken.text.trim()
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

async function publishedCaption(file: string): Promise<string> {
  const dir = path.dirname(file)
  const base = path.basename(file, path.extname(file))
  const names = await readdir(dir).catch(() => [] as string[])
  const caption = names.find((name) => name.startsWith(`${base}.`) && name.toLowerCase().endsWith('.vtt'))
  if (!caption) return ''
  const raw = await readFile(path.join(dir, caption), 'utf8').catch(() => '')
  return captionText(raw)
}

function captionText(raw: string): string {
  const lines = raw.replace(/^\uFEFF/, '').split(/\r?\n/).flatMap((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed === 'WEBVTT' || trimmed.startsWith('NOTE') || trimmed.startsWith('Kind:') || trimmed.startsWith('Language:')) return []
    if (/^\d+$/.test(trimmed) || trimmed.includes('-->')) return []
    const spoken = trimmed.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
    return spoken.length > 1 ? [spoken] : []
  })
  const unique: string[] = []
  for (const line of lines) {
    if (unique[unique.length - 1] !== line) unique.push(line)
  }
  const blocks: string[] = []
  let current = ''
  for (const line of unique) {
    const next = current ? `${current} ${line}` : line
    if (next.length > 420 && current) {
      blocks.push(current)
      current = line
    } else {
      current = next
    }
  }
  if (current) blocks.push(current)
  const text = blocks.join('\n\n').slice(0, 200000)
  return text.length >= 40 ? text : ''
}

async function downloadVideo(target: URL, dest: string, hops = 0): Promise<void> {
  if (hops > 3) throw new Error('The video could not be opened.')
  const response = await fetch(target, {
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'video/mp4,*/*' },
    redirect: 'manual',
    signal: AbortSignal.timeout(5 * 60 * 1000)
  })
  if (response.status >= 300 && response.status < 400) {
    const next = response.headers.get('location')
    await response.body?.cancel().catch(() => undefined)
    if (!next) throw new Error('The video could not be opened.')
    const followed = new URL(next, target)
    if (followed.protocol !== 'https:' || followed.hostname !== 'video.twimg.com') throw new Error('The video could not be opened.')
    return downloadVideo(followed, dest, hops + 1)
  }
  if (!response.ok || !response.body) throw new Error(`The video could not be opened (${response.status}).`)
  const length = Number(response.headers.get('content-length') || 0)
  if (length > MAX_BYTES) {
    await response.body.cancel().catch(() => undefined)
    throw new Error('That video is too large to transcribe.')
  }
  let received = 0
  const limited = new Transform({
    transform(chunk, _encoding, callback) {
      received += chunk.length
      if (received > MAX_BYTES) {
        callback(new Error('That video is too large to transcribe.'))
        return
      }
      callback(null, chunk)
    }
  })
  await pipeline(Readable.fromWeb(response.body as import('stream/web').ReadableStream<Uint8Array>), limited, createWriteStream(dest))
}
