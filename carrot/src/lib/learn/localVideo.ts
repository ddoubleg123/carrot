import { spawn } from 'child_process'
import { ffmpegPath, nodeBin, ytdlpPath } from '@/lib/mediaBins'
import { mkdir, readdir, readFile, writeFile } from 'fs/promises'
import path from 'path'

export interface LocalVideoJob {
  id: string
  status: 'running' | 'completed' | 'failed'
  progress: number
  error?: string
  videoUrl?: string
  title?: string
  thumbnail?: string
  transcript?: string
}

const jobs = new Map<string, LocalVideoJob>()
let ytDlpPath: string | null = null
let ffmpegDir: string | null = null
let nodePath: string | null | undefined


function captionText(raw: string, limit = 6000): string {
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
  const spoken = blocks.join('\n\n')
  return limit > 0 ? spoken.slice(0, limit) : spoken
}

function videoHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase()
    return host === 'youtu.be' || host.endsWith('youtube.com') || host === 'x.com' || host === 'twitter.com' || host.endsWith('facebook.com') || host === 'fb.watch' || host.endsWith('reddit.com') || host.endsWith('tiktok.com')
  } catch {
    return false
  }
}

export function localVideoJob(id: string): LocalVideoJob | null {
  return jobs.get(id) || null
}

function reason(errors: string): string {
  const lines = errors.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const error = [...lines].reverse().find((line) => /^ERROR:/i.test(line)) || lines[lines.length - 1] || ''
  const text = error.replace(/^ERROR:\s*/i, '').replace(/\s+/g, ' ')
  if (/429|too many requests/i.test(text)) return 'YouTube is limiting requests right now. Wait a minute and run it again.'
  if (/sign in|not a bot|login required/i.test(text)) return 'YouTube asked for a sign-in, so the copy was not saved.'
  if (/ffmpeg/i.test(text)) return 'The copy could not be merged into a playable file.'
  return text ? `The video could not be saved from that link. ${text.slice(0, 160)}` : 'The video could not be saved from that link.'
}

function runTool(binary: string, args: string[], env: NodeJS.ProcessEnv, onProgress?: (percent: number) => void, killAfter = 600000): Promise<{ code: number; output: string; errors: string }> {
  return new Promise((resolve) => {
    let output = ''
    let errors = ''
    const child = spawn(binary, args, { env, windowsHide: true })
    const timer = setTimeout(() => child.kill(), killAfter)
    child.stdout.on('data', (chunk) => {
      output = (output + String(chunk)).slice(-2000)
    })
    child.stderr.on('data', (chunk) => {
      const text = String(chunk)
      errors = (errors + text).slice(-1200)
      const match = text.match(/(\d+(?:\.\d+)?)%/)
      if (match && onProgress) onProgress(Math.min(95, Math.round(Number(match[1]))))
    })
    const finish = (code: number) => {
      clearTimeout(timer)
      resolve({ code, output, errors })
    }
    child.on('error', () => finish(1))
    child.on('close', (status) => finish(status ?? 1))
  })
}

export async function startLocalVideo(pageUrl: string, options?: { maxHeight?: number }): Promise<LocalVideoJob> {
  if (!videoHost(pageUrl)) {
    return { id: '', status: 'failed', progress: 0, error: 'Paste a video link from YouTube, X, Facebook, Reddit, or TikTok.' }
  }
  if (!ytDlpPath) ytDlpPath = await ytdlpPath()
  if (!ytDlpPath) {
    return { id: '', status: 'failed', progress: 0, error: 'The video tool is not installed on this machine.' }
  }
  if (!ffmpegDir) {
    const ffmpeg = await ffmpegPath()
    ffmpegDir = ffmpeg ? path.dirname(ffmpeg) : ''
  }
  if (nodePath === undefined) nodePath = nodeBin()
  const id = `local-${Date.now().toString(36)}`
  const job: LocalVideoJob = { id, status: 'running', progress: 5 }
  jobs.set(id, job)
  void runLocalVideo(job, pageUrl, ytDlpPath, ffmpegDir, nodePath || '', options?.maxHeight || 720)
  return job
}

async function runLocalVideo(job: LocalVideoJob, pageUrl: string, binary: string, ffmpegDirectory: string, node: string, maxHeight: number) {
  const dir = path.join(process.cwd(), 'public', 'topic-videos')
  await mkdir(dir, { recursive: true })
  const base = path.join(dir, job.id)
  const env = { ...process.env }
  if (ffmpegDirectory) env.PATH = `${ffmpegDirectory}${path.delimiter}${env.PATH || ''}`
  const shared = [
    '--no-update',
    '--no-playlist',
    ...(ffmpegDirectory ? ['--ffmpeg-location', ffmpegDirectory] : []),
    ...(node ? ['--js-runtimes', 'node'] : [])
  ]
  const saved = await runTool(binary, [
    ...shared,
    '-f', `bv*[height<=${maxHeight}]+ba/b[height<=${maxHeight}]/b`,
    '--merge-output-format', 'mp4',
    '--retries', '3',
    '--write-thumbnail',
    '--print', 'after_move:title',
    '-o', `${base}.%(ext)s`,
    pageUrl
  ], env, (percent) => {
    job.progress = percent
  })
  if (saved.code !== 0) {
    job.status = 'failed'
    job.progress = 0
    job.error = reason(saved.errors)
    return
  }
  const output = saved.output
  const hasCaption = async () => {
    const names = await readdir(dir).catch(() => [] as string[])
    return names.some((file) => file.startsWith(`${job.id}.`) && file.toLowerCase().endsWith('.vtt'))
  }
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (await hasCaption()) break
    job.progress = 96
    await runTool(binary, [
      ...shared,
      '--skip-download',
      '--write-sub',
      '--write-auto-sub',
      '--sub-langs', 'en-orig,en,en-US,en-GB',
      '--convert-subs', 'vtt',
      '-o', `${base}.%(ext)s`,
      pageUrl
    ], env, undefined, 90000)
    if (await hasCaption()) break
    if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 15000 * (attempt + 1)))
  }
  const files = await readdir(dir).catch(() => [] as string[])
  const video = files.find((file) => file.startsWith(`${job.id}.`) && file.toLowerCase().endsWith('.mp4'))
  if (!video) {
    job.status = 'failed'
    job.progress = 0
    job.error = 'The video could not be saved as a file we can play.'
    return
  }
  const caption = files.find((file) => file.startsWith(`${job.id}.`) && file.toLowerCase().endsWith('.vtt'))
  const thumb = files.find((file) => file.startsWith(`${job.id}.`) && /\.(jpe?g|webp|png)$/i.test(file))
  if (caption) {
    const text = await readFile(path.join(dir, caption), 'utf8').catch(() => '')
    const full = captionText(text, 0)
    if (full.length >= 40) {
      await writeFile(path.join(dir, `${job.id}.txt`), full)
      job.transcript = full.slice(0, 6000)
    }
  }
  const title = output.split(/\r?\n/).map((line) => line.trim()).find((line) => line && !line.includes('%'))
  job.title = (title || 'Video').slice(0, 180)
  job.videoUrl = `/topic-videos/${video}`
  if (thumb) job.thumbnail = `/topic-videos/${thumb}`
  job.progress = 100
  job.status = 'completed'
}
