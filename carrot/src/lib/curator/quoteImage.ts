import { execFile } from 'child_process'
import { createHash } from 'crypto'
import { access, mkdir } from 'fs/promises'
import path from 'path'
import { promisify } from 'util'

const run = promisify(execFile)
const BUCKET = 'involuted-river-466315-p0.firebasestorage.app'

export interface QuoteVariation {
  direction: string
  palette: number
  file: string
  quality: 'high'
}

async function publishVariation(file: string, name: string): Promise<string | null> {
  if (!process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) return null
  const bucketId = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || BUCKET
  const objectPath = `quote-cards/${name}`
  const { app } = await import('@/lib/firebase-admin')
  const admin = require('firebase-admin')
  const bucket = admin.storage(app).bucket(bucketId)
  await bucket.upload(file, {
    destination: objectPath,
    metadata: { contentType: 'image/png', cacheControl: 'public, max-age=31536000' }
  })
  return `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucketId)}/o/${encodeURIComponent(objectPath)}?alt=media`
}

/** Render every high-quality variation. Empty on a laptop, or when none pass. */
export async function renderQuoteCard(sentence: string, source: string, imageUrl: string): Promise<string[]> {
  if (process.env.RENDER !== 'true') return []
  const clean = imageUrl.split('?')[0]
  if (!clean.startsWith('/') || clean.includes('..')) return []
  const photo = path.join(process.cwd(), 'public', clean.slice(1))
  try {
    await access(photo)
  } catch {
    return []
  }
  const id = createHash('sha1').update(sentence).digest('hex').slice(0, 12)
  const dir = path.join(process.cwd(), 'public', 'quote-cards', id)
  await mkdir(dir, { recursive: true })
  const script = path.join(process.cwd(), 'quote-review', 'kit', 'kit', 'ship.py')
  let stdout = ''
  try {
    const result = await run('python3', [
      script,
      '--id', id,
      '--quote', sentence,
      '--speaker', source || 'Narration',
      '--photo', photo,
      '--out', dir
    ], { timeout: 300000, windowsHide: true, maxBuffer: 4_000_000 })
    stdout = String(result.stdout || '')
  } catch (error) {
    const failed = error as { stdout?: string }
    stdout = String(failed?.stdout || '')
  }
  const line = stdout.split('\n').map((row) => row.trim()).filter((row) => row.startsWith('RESULT ')).pop()
  if (!line) return []
  const parsed = JSON.parse(line.slice('RESULT '.length)) as { passes?: QuoteVariation[] }
  const urls: string[] = []
  for (const pass of parsed.passes || []) {
    if (pass.quality !== 'high' || !pass.file) continue
    const name = `${id}__${pass.direction}__p${pass.palette}.png`
    const stored = await publishVariation(pass.file, name)
    urls.push(stored || `/quote-cards/${id}/${name}`)
  }
  return urls
}
