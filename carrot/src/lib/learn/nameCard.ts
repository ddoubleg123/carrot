import { spawn } from 'child_process'
import { mkdtemp, rm, stat } from 'fs/promises'
import os from 'os'
import path from 'path'
import { ffmpegPath } from '@/lib/mediaBins'

const TITLES = 'Mr|Mrs|Ms|Miss|Dr'
const SUBORDINATE = /^(because|since|although|though|while|if|when|which|who|that|after|before|unless|until)\b/i
const SCRIPT = path.join(process.cwd(), 'scripts', 'name-card.ps1')
const SAMPLES = [12, 28, 44, 60]

export function editDistance(left: string, right: string): number {
  const a = left.toLowerCase()
  const b = right.toLowerCase()
  const rows = Array.from({ length: a.length + 1 }, (_, index) => [index])
  for (let col = 1; col <= b.length; col += 1) rows[0][col] = col
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost)
    }
  }
  return rows[a.length][b.length]
}

export function titledSurnames(text: string): string[] {
  const found: string[] = []
  const pattern = new RegExp(`\\b(?:${TITLES}|M\\s*[a-z])\\.?\\s+([A-Z][A-Za-z'’-]{2,})\\b`, 'g')
  for (const match of text.matchAll(pattern)) {
    const name = match[1]
    if (!found.some((item) => item.toLowerCase() === name.toLowerCase())) found.push(name)
  }
  return found
}

export function applyCardNames(text: string, cardText: string): string {
  const cards = titledSurnames(cardText)
  let next = text
  for (const name of titledSurnames(text)) {
    let best = ''
    let dist = 3
    for (const card of cards) {
      if (card.toLowerCase() === name.toLowerCase()) {
        best = ''
        break
      }
      const gap = editDistance(name, card)
      if (gap >= 1 && gap < dist && Math.abs(name.length - card.length) <= 2) {
        best = card
        dist = gap
      }
    }
    if (!best) continue
    next = next.replace(new RegExp(`\\b${name}\\b`, 'g'), best)
  }
  return next
}

export function brokenPost(text: string): boolean {
  const first = text.trim().split(/(?<=[.!?])\s+/)[0] || ''
  if (!first) return true
  if (/^(and|but|because|uh|um)\b/i.test(first)) return true
  const rest = first.replace(new RegExp(`^(?:(?:${TITLES})\\.?\\s+)?[A-Z][A-Za-z'’-]{2,},\\s+`), '')
  return rest !== first && SUBORDINATE.test(rest)
}

export function bareWitness(post: string, source: string): boolean {
  const name = post.trim().match(/^([A-Z][A-Za-z'’-]{2,}),\s/)?.[1]
  if (!name) return false
  return new RegExp(`\\b(?:${TITLES})\\.?\\s+${name}\\b`).test(source)
}

function run(command: string, args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { windowsHide: true })
    let out = ''
    const timer = setTimeout(() => {
      child.kill()
      resolve('')
    }, timeoutMs)
    child.stdout.on('data', (chunk) => { out += chunk.toString() })
    child.on('error', () => {
      clearTimeout(timer)
      resolve('')
    })
    child.on('close', () => {
      clearTimeout(timer)
      resolve(out.replace(/\s+/g, ' ').trim())
    })
  })
}

async function frame(ffmpeg: string, video: string, at: number, dest: string): Promise<boolean> {
  await run(ffmpeg, [
    '-y', '-ss', String(at), '-i', video, '-frames:v', '1',
    '-vf', 'crop=iw:ih*0.42:0:ih*0.38', dest
  ], 20000)
  const info = await stat(dest).catch(() => null)
  return Boolean(info?.isFile() && info.size > 1000)
}

async function readFrame(file: string): Promise<string> {
  if (process.platform === 'win32') return run('powershell', ['-NoProfile', '-File', SCRIPT, file], 20000)
  return run('tesseract', [file, 'stdout', '--psm', '6'], 20000)
}

export async function readNameCard(video: string): Promise<string> {
  const ffmpeg = await ffmpegPath()
  if (!ffmpeg || !video) return ''
  const dir = await mkdtemp(path.join(os.tmpdir(), 'namecard-'))
  const seen: string[] = []
  try {
    for (const at of SAMPLES) {
      const dest = path.join(dir, `${at}.jpg`)
      const made = await frame(ffmpeg, video, at, dest)
      if (!made) continue
      const text = await readFrame(dest)
      if (text) seen.push(text)
    }
    return seen.join(' ')
  } catch {
    return seen.join(' ')
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined)
  }
}

export async function correctClipNames(video: string, text: string): Promise<string> {
  if (!text || !titledSurnames(text).length) return text
  const card = await readNameCard(video).catch(() => '')
  if (!card) return text
  return applyCardNames(text, card)
}
