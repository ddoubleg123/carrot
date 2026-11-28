import { readFile } from 'fs/promises'
import path from 'path'
import { NextResponse } from 'next/server'
import { pageImage, savedPreview, savePreview } from '@/lib/curator/preview'

export const dynamic = 'force-dynamic'

let running = 0
const waiting: Array<() => void> = []

function takeSlot(): Promise<void> {
  if (running < 3) {
    running += 1
    return Promise.resolve()
  }
  return new Promise((resolve) => waiting.push(resolve))
}

function freeSlot() {
  const next = waiting.shift()
  if (next) next()
  else running -= 1
}

function thumbFile(image: string): string | null {
  if (!/^\/curator-thumbs\/[a-f0-9]{16}\.(jpg|png|webp)$/.test(image)) return null
  return path.join(process.cwd(), 'public', image.slice(1))
}

function thumbType(image: string): string {
  if (image.endsWith('.png')) return 'image/png'
  if (image.endsWith('.webp')) return 'image/webp'
  return 'image/jpeg'
}

/** The picture itself, after it is on disk. An empty page gets no image response. */
async function picture(image: string, asFile: boolean) {
  if (!asFile) return NextResponse.json({ image })
  const file = thumbFile(image)
  if (!file) return new NextResponse(null, { status: 204 })
  const buf = await readFile(file).catch(() => null)
  if (!buf) return new NextResponse(null, { status: 204 })
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': thumbType(image),
      'Cache-Control': 'private, max-age=86400'
    }
  })
}

/** Refill a missing article picture. Localhost, or a curator secret from anywhere else. */
export async function GET(request: Request) {
  const host = request.headers.get('host') || ''
  const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host)
  const secret = process.env.CURATOR_SECRET || process.env.INGEST_WORKER_SECRET || ''
  const header = request.headers.get('x-curator-secret') || ''
  if (!local && (!secret || header !== secret)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const asked = new URL(request.url)
  const page = asked.searchParams.get('url') || ''
  const asFile = asked.searchParams.get('file') === '1'
  if (!/^https?:\/\//i.test(page)) return asFile ? new NextResponse(null, { status: 204 }) : NextResponse.json({ image: '' })
  const cached = await savedPreview(page)
  if (cached) return picture(cached, asFile)
  await takeSlot()
  try {
    const remote = await pageImage(page)
    if (!remote) return asFile ? new NextResponse(null, { status: 204 }) : NextResponse.json({ image: '' })
    const image = await savePreview(remote, page)
    if (!image) return asFile ? new NextResponse(null, { status: 204 }) : NextResponse.json({ image: '' })
    return picture(image, asFile)
  } finally {
    freeSlot()
  }
}
