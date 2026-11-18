import { execFile, spawn } from 'child_process'
import { mkdir, readdir, readFile } from 'fs/promises'
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

function toolPath(command: string): Promise<string | null> {
  return new Promise((resolve) => {
    execFile('where.exe', [command], { timeout: 8000, windowsHide: true }, (error, stdout) => {
      if (error) {
        resolve(null)
        return
      }
      resolve(stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean) || null)
    })
  })
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
  return blocks.join('\n\n').slice(0, 6000)
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

export async function startLocalVideo(pageUrl: string): Promise<LocalVideoJob> {
  if (!videoHost(pageUrl)) {
    return { id: '', status: 'failed', progress: 0, error: 'Paste a video link from YouTube, X, Facebook, Reddit, or TikTok.' }
  }
  if (!ytDlpPath) ytDlpPath = await toolPath('yt-dlp')
  if (!ytDlpPath) {
    return { id: '', status: 'failed', progress: 0, error: 'The video tool is not installed on this machine.' }
  }
  if (!ffmpegDir) {
    const ffmpeg = await toolPath('ffmpeg')
    ffmpegDir = ffmpeg ? path.dirname(ffmpeg) : ''
  }
  const id = `local-${Date.now().toString(36)}`
  const job: LocalVideoJob = { id, status: 'running', progress: 5 }
  jobs.set(id, job)
  void runLocalVideo(job, pageUrl, ytDlpPath, ffmpegDir)
  return job
}

async function runLocalVideo(job: LocalVideoJob, pageUrl: string, binary: string, ffmpegDirectory: string) {
  const dir = path.join(process.cwd(), 'public', 'topic-videos')
  await mkdir(dir, { recursive: true })
  const base = path.join(dir, job.id)
  const args = [
    '--no-update',
    '--no-playlist',
    '--no-warnings',
    '-f', 'bv*[height<=720]+ba/b[height<=720]/b',
    '--merge-output-format', 'mp4',
    '--write-sub',
    '--write-auto-sub',
    '--sub-langs', 'en.*',
    '--convert-subs', 'vtt',
    '--write-thumbnail',
    '--print', 'after_move:title',
    '-o', `${base}.%(ext)s`,
    pageUrl
  ]
  const env = { ...process.env }
  if (ffmpegDirectory) env.PATH = `${ffmpegDirectory};${env.PATH || ''}`
  let output = ''
  let errors = ''
  const child = spawn(binary, args, { env, windowsHide: true })
  const timer = setTimeout(() => {
    child.kill()
  }, 180000)
  child.stdout.on('data', (chunk) => {
    output += String(chunk)
  })
  child.stderr.on('data', (chunk) => {
    const text = String(chunk)
    errors = (errors + text).slice(-800)
    const match = text.match(/(\d+(?:\.\d+)?)%/)
    if (match) job.progress = Math.min(95, Math.round(Number(match[1])))
  })
  const code: number | null = await new Promise((resolve) => {
    child.on('error', () => resolve(1))
    child.on('close', (status) => resolve(status))
  })
  clearTimeout(timer)
  if (code !== 0) {
    job.status = 'failed'
    job.progress = 0
    job.error = 'The video could not be saved from that link.'
    return
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
    const spoken = captionText(text)
    if (spoken.length >= 40) job.transcript = spoken
  }
  const title = output.split(/\r?\n/).map((line) => line.trim()).find((line) => line && !line.includes('%'))
  job.title = (title || 'Video').slice(0, 180)
  job.videoUrl = `/topic-videos/${video}`
  if (thumb) job.thumbnail = `/topic-videos/${thumb}`
  job.progress = 100
  job.status = 'completed'
  void errors
}
