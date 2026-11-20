import { execFile } from 'child_process'
import { mkdtemp, rename, rm } from 'fs/promises'
import os from 'os'
import path from 'path'
import QRCode from 'qrcode'
import sharp from 'sharp'
import { ffmpegPath } from '@/lib/mediaBins'

const SITE = 'https://carrot-app.onrender.com'
const LOGO = path.join(process.cwd(), 'public', 'carrot-logo.png')
const CHOMP = path.join(process.cwd(), 'public', 'sounds', 'carrotnom.mp3')
const CARD_SECONDS = 2.4

function run(binary: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(binary, args, { windowsHide: true, timeout: 180000 }, (error, _stdout, stderr) => {
      if (error) reject(new Error(String(stderr || error.message).slice(-400)))
      else resolve()
    })
  })
}

function probe(ffmpeg: string, file: string): Promise<{ width: number; height: number; duration: number; audio: boolean }> {
  return new Promise((resolve, reject) => {
    execFile(ffmpeg, ['-hide_banner', '-i', file], { windowsHide: true, timeout: 20000 }, (_error, stdout, stderr) => {
      const text = `${stdout || ''}\n${stderr || ''}`
      const duration = text.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/)
      const video = text.match(/Video:[\s\S]*?(\d{2,5})x(\d{2,5})/)
      if (!duration) {
        reject(new Error('The clip length could not be read.'))
        return
      }
      resolve({
        width: video ? Number(video[1]) : 854,
        height: video ? Number(video[2]) : 480,
        duration: Number(duration[1]) * 3600 + Number(duration[2]) * 60 + Number(duration[3]),
        audio: /Audio:/.test(text)
      })
    })
  })
}


/** The posting account's profile. Every post from that account is listed there. */
export function profileQrUrl(username: string): string {
  const base = (process.env.NEXTAUTH_URL || SITE).replace(/\/$/, '')
  return `${base}/people/${encodeURIComponent(username)}`
}

async function carrotPng(height: number): Promise<Buffer> {
  const { data, info } = await sharp(LOGO).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  for (let i = 0; i < data.length; i += 4) {
    const max = Math.max(data[i], data[i + 1], data[i + 2])
    if (max < 16) data[i + 3] = 0
    else if (max < 36) data[i + 3] = Math.round(((max - 16) / 20) * 255)
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .trim({ threshold: 1 })
    .resize({ height, fit: 'inside' })
    .png()
    .toBuffer()
}

async function endCard(dir: string, width: number, height: number, pageUrl: string): Promise<{ card: string; mark: string }> {
  const qrSize = Math.round(Math.min(width, height) * 0.46)
  const qr = await QRCode.toBuffer(pageUrl, {
    width: qrSize,
    margin: 2,
    errorCorrectionLevel: 'H',
    color: { dark: '#111111', light: '#FFFFFF' }
  })
  const logo = await carrotPng(Math.round(qrSize * 0.62))
  const qrMeta = await sharp(qr).metadata()
  const logoMeta = await sharp(logo).metadata()
  const qrWidth = qrMeta.width || qrSize
  const qrHeight = qrMeta.height || qrSize
  const logoWidth = logoMeta.width || qrSize
  const logoHeight = logoMeta.height || Math.round(qrSize * 0.42)
  const gap = Math.round(height * 0.035)
  const wordSize = Math.max(15, Math.round(height * 0.042))
  const wordGap = Math.round(height * 0.012)
  const word = Buffer.from(`<svg width="${width}" height="${Math.round(wordSize * 1.8)}"><text x="50%" y="72%" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${wordSize}" font-weight="500" letter-spacing="${Math.round(wordSize * 0.08)}" fill="#F4F1EA">gotcarrot.com</text></svg>`)
  const wordHeight = Math.round(wordSize * 1.8)
  const stack = qrHeight + gap + logoHeight + wordGap + wordHeight
  const top = Math.max(8, Math.round((height - stack) / 2))
  const card = path.join(dir, 'end.png')
  const mark = path.join(dir, 'mark.png')
  await sharp({ create: { width, height, channels: 3, background: '#000000' } })
    .composite([
      { input: qr, left: Math.round((width - qrWidth) / 2), top },
      { input: logo, left: Math.round((width - logoWidth) / 2), top: top + qrHeight + gap },
      { input: word, left: 0, top: top + qrHeight + gap + logoHeight + wordGap }
    ])
    .png()
    .toFile(card)
  await sharp(logo).png().toFile(mark)
  return { card, mark }
}

/** Burn the menu carrot on the clip and add a short end card: QR, then the carrot, with the chomp. */
export async function brandClip(ffmpeg: string, file: string, pageUrl: string): Promise<void> {
  const info = await probe(ffmpeg, file)
  const dir = await mkdtemp(path.join(os.tmpdir(), 'carrot-brand-'))
  const out = path.join(dir, 'branded.mp4')
  try {
    const { card, mark } = await endCard(dir, info.width, info.height, pageUrl)
    const delay = Math.max(0, Math.round(info.duration * 1000))
    const video = `[1:v]scale=-1:${Math.round(info.height * 0.15)}[logo];[0:v][logo]overlay=W-w-20:H-h-36:format=auto[main];[2:v]scale=${info.width}:${info.height},format=yuv420p[end];[main]format=yuv420p[main420];[main420][end]concat=n=2:v=1:a=0[v]`
    const audio = info.audio
      ? `;[0:a]apad=pad_dur=${CARD_SECONDS}[speech];[3:a]adelay=${delay}:all=1[bite];[speech][bite]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0[a]`
      : `;[3:a]adelay=${delay}:all=1,apad=pad_dur=${CARD_SECONDS}[a]`
    await run(ffmpeg, [
      '-y', '-i', file, '-i', mark, '-loop', '1', '-framerate', '24', '-t', String(CARD_SECONDS), '-i', card, '-i', CHOMP,
      '-filter_complex', `${video}${audio}`,
      '-map', '[v]', '-map', '[a]',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'veryfast', '-crf', '20', '-c:a', 'aac', '-movflags', '+faststart',
      out
    ])
    await rename(out, file)
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined)
  }
}

export async function stampClip(file: string, pageUrl: string): Promise<void> {
  const ffmpeg = await ffmpegPath()
  if (!ffmpeg) throw new Error('ffmpeg is not installed on this machine.')
  await brandClip(ffmpeg, file, pageUrl)
}
