import { execFile } from 'child_process'
import { createWriteStream } from 'fs'
import { chmod, mkdir, stat } from 'fs/promises'
import path from 'path'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import { createGunzip } from 'zlib'

const DIR = path.join(process.cwd(), '.cache', 'tools')
const WIN_YT = 'C:\\Tools\\yt-dlp\\yt-dlp.exe'
const WIN_FF = 'C:\\ffmpeg-bin\\ffmpeg-7.1.1-essentials_build\\bin\\ffmpeg.exe'
const FFMPEG_URL = 'https://github.com/eugeneware/ffmpeg-static/releases/download/b6.1.1/ffmpeg-linux-x64.gz'
const YTDLP_URL = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux'

let ready: Promise<{ ytdlp: string | null; ffmpeg: string | null }> | null = null
let bins: { ytdlp: string | null; ffmpeg: string | null } = { ytdlp: null, ffmpeg: null }

function exists(file: string): Promise<boolean> {
  return stat(file).then(() => true).catch(() => false)
}

function lookup(command: string): Promise<string | null> {
  const which = process.platform === 'win32' ? 'where.exe' : 'which'
  return new Promise((resolve) => {
    execFile(which, [command], { timeout: 8000, windowsHide: true }, (error, stdout) => {
      if (error) resolve(null)
      else resolve(String(stdout).split(/\r?\n/).map((line) => line.trim()).find(Boolean) || null)
    })
  })
}

async function download(url: string, dest: string, gzip: boolean) {
  await mkdir(path.dirname(dest), { recursive: true })
  const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(180000) })
  if (!response.ok || !response.body) throw new Error(`The media tool download returned ${response.status}.`)
  const source = Readable.fromWeb(response.body as import('stream/web').ReadableStream)
  const out = createWriteStream(dest)
  if (gzip) await pipeline(source, createGunzip(), out)
  else await pipeline(source, out)
  if (process.platform !== 'win32') await chmod(dest, 0o755)
}

async function install(): Promise<{ ytdlp: string | null; ffmpeg: string | null }> {
  let ytdlp = process.platform === 'win32' && await exists(WIN_YT) ? WIN_YT : await lookup('yt-dlp')
  let ffmpeg = process.platform === 'win32' && await exists(WIN_FF) ? WIN_FF : await lookup('ffmpeg')
  if (process.platform !== 'win32') {
    const ytdlpFile = path.join(DIR, 'yt-dlp')
    const ffmpegFile = path.join(DIR, 'ffmpeg')
    if (!ytdlp) {
      if (!(await exists(ytdlpFile))) await download(YTDLP_URL, ytdlpFile, false)
      ytdlp = ytdlpFile
    }
    if (!ffmpeg) {
      if (!(await exists(ffmpegFile))) await download(FFMPEG_URL, ffmpegFile, true)
      ffmpeg = ffmpegFile
    }
  }
  bins = { ytdlp, ffmpeg }
  return bins
}

/** Find yt-dlp and ffmpeg. On the server, download them once into the local tool cache. */
export function ensureMediaBins(): Promise<{ ytdlp: string | null; ffmpeg: string | null }> {
  if (!ready) {
    ready = install().catch((error) => {
      ready = null
      throw error
    })
  }
  return ready
}

export async function ytdlpPath(): Promise<string | null> {
  return (await ensureMediaBins().catch(() => bins)).ytdlp
}

export async function ffmpegPath(): Promise<string | null> {
  return (await ensureMediaBins().catch(() => bins)).ffmpeg
}

export function nodeBin(): string {
  return process.execPath
}
