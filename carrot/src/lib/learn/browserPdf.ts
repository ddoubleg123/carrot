import { spawn } from 'child_process'
import { createHash } from 'crypto'
import { open, rm, stat } from 'fs/promises'
import path from 'path'

const DIR = path.join(process.cwd(), '.cache', 'learn-pdfs')
const SCRIPT = path.join(process.cwd(), 'scripts', 'fetch_open_pdf.py')
const pending = new Map<string, Promise<string | null>>()

export function cachedPdfPath(url: string): string {
  const name = createHash('sha256').update(url).digest('hex').slice(0, 40)
  return path.join(DIR, `${name}.pdf`)
}

async function pdfFile(file: string): Promise<boolean> {
  const info = await stat(file).catch(() => null)
  if (!info?.isFile() || info.size < 100 || info.size > 20_000_000) return false
  const handle = await open(file, 'r').catch(() => null)
  if (!handle) return false
  try {
    const buf = Buffer.alloc(5)
    const read = await handle.read(buf, 0, 5, 0)
    return read.bytesRead === 5 && buf.toString('latin1') === '%PDF-'
  } finally {
    await handle.close().catch(() => undefined)
  }
}

function runFetch(url: string, dest: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn('python', [SCRIPT, url, dest], { windowsHide: true })
    const timer = setTimeout(() => {
      child.kill()
      resolve(false)
    }, 60_000)
    child.on('error', () => {
      clearTimeout(timer)
      resolve(false)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve(code === 0)
    })
  })
}

export async function readCachedPdf(url: string): Promise<string | null> {
  const dest = cachedPdfPath(url)
  return (await pdfFile(dest)) ? dest : null
}

export async function ensureOpenPdf(url: string): Promise<string | null> {
  const dest = cachedPdfPath(url)
  if (await pdfFile(dest)) return dest
  const current = pending.get(dest)
  if (current) return current
  const job = (async () => {
    if (await pdfFile(dest)) return dest
    const saved = await runFetch(url, dest)
    if (saved && await pdfFile(dest)) return dest
    await rm(dest, { force: true }).catch(() => undefined)
    return null
  })()
  pending.set(dest, job)
  try {
    return await job
  } finally {
    if (pending.get(dest) === job) pending.delete(dest)
  }
}
