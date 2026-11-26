import { execFile } from 'child_process'
import { createHash } from 'crypto'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { promisify } from 'util'

const run = promisify(execFile)
const BUCKET = 'involuted-river-466315-p0.firebasestorage.app'

export interface QuoteVariation {
  direction: string
  palette: string
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

export interface QuoteCardJob {
  sentence: string
  speaker: string
  context?: string
  date?: string
  imageUrl?: string | null
}

/** Render with the v2 kit. Empty on a laptop, or when every variant fails a gate. */
export async function renderQuoteCard(card: QuoteCardJob): Promise<string[]> {
  const onServer = process.env.RENDER === 'true' || Boolean(process.env.RENDER_SERVICE_ID)
  if (!onServer) return []
  const sentence = card.sentence.trim()
  const speaker = card.speaker.trim()
  if (!sentence || !speaker) return []
  const id = createHash('sha1').update(sentence).digest('hex').slice(0, 12)
  const dir = path.join(process.cwd(), 'public', 'quote-cards', id)
  await mkdir(dir, { recursive: true })
  let picture = ''
  const imageUrl = card.imageUrl || ''
  const local = imageUrl.split('?')[0]
  if (local.startsWith('/') && !local.includes('..')) {
    picture = path.join(process.cwd(), 'public', local.slice(1))
  } else if (/^https?:\/\//i.test(imageUrl)) {
    picture = imageUrl
  }
  const jobPath = path.join(dir, 'job.json')
  await writeFile(jobPath, JSON.stringify({
    id,
    quote: sentence,
    speaker,
    context: card.context || '',
    date: card.date || '',
    picture
  }))
  const script = path.join(process.cwd(), 'quote-cards', 'kit', 'service.py')
  let stdout = ''
  try {
    const result = await run('python3', [
      script,
      '--job', jobPath,
      '--out', dir,
      '--variants', process.env.VARIANTS_PER_QUOTE || '12',
      '--shortlist', process.env.SHORTLIST_SIZE || '8'
    ], { timeout: 300000, windowsHide: true, maxBuffer: 8_000_000 })
    stdout = String(result.stdout || '')
  } catch (error) {
    const failed = error as { stdout?: string; stderr?: string; message?: string }
    stdout = String(failed?.stdout || '')
    const detail = String(failed?.stderr || failed?.message || '').replace(/\s+/g, ' ').trim().slice(0, 400)
    if (detail) console.error('[quote-card]', detail)
  }
  const line = stdout.split('\n').map((row) => row.trim()).filter((row) => row.startsWith('RESULT ')).pop()
  if (!line) {
    console.error('[quote-card] no result')
    return []
  }
  const parsed = JSON.parse(line.slice('RESULT '.length)) as { passes?: QuoteVariation[] }
  const urls: string[] = []
  for (const pass of parsed.passes || []) {
    if (pass.quality !== 'high' || !pass.file) continue
    const name = `${id}__${pass.direction}__${pass.palette}.png`
    const stored = await publishVariation(pass.file, name)
    urls.push(stored || `/quote-cards/${id}/${name}`)
  }
  return urls
}
