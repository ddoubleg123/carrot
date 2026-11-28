import { createReadStream } from 'fs'
import { readFile, stat } from 'fs/promises'
import path from 'path'
import { Readable } from 'node:stream'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { ensureOpenPdf, readCachedPdf } from '@/lib/learn/browserPdf'
import { isPdfLink } from '@/lib/learn/pdfLink'
import { assertPublicUrl, PublicUrlError } from '@/lib/learn/publicUrl'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BYTES = 8_000_000

function pdfTarget(raw: string): Promise<URL> {
  return assertPublicUrl(raw).then((url) => {
    if (!isPdfLink(url.toString())) throw new PublicUrlError('That file is not a PDF.')
    return url
  })
}

async function openPdf(target: URL, range: string | null, hops = 0): Promise<Response | null> {
  if (hops > 3) return null
  const headers: Record<string, string> = { 'User-Agent': 'CarrotLearn/1.0', Accept: 'application/pdf,*/*' }
  if (range) headers.Range = range
  const response = await fetch(target, { headers, redirect: 'manual', signal: AbortSignal.timeout(20000) }).catch(() => null)
  if (!response) return null
  if (response.status >= 300 && response.status < 400) {
    const next = response.headers.get('location')
    await response.body?.cancel().catch(() => undefined)
    if (!next) return null
    const followed = await pdfTarget(new URL(next, target).toString()).catch(() => null)
    if (!followed) return null
    return openPdf(followed, range, hops + 1)
  }
  return response
}

function downloadName(name: string): string {
  const clean = (name.split(/[/\\]/).pop() || 'document').replace(/\.pdf$/i, '').replace(/[^A-Za-z0-9._ -]+/g, '').trim().slice(0, 80) || 'document'
  return `${clean}.pdf`
}

function viewerHeaders(download = ''): Headers {
  const headers = new Headers()
  headers.set('content-type', 'application/pdf')
  headers.set('content-disposition', download ? `attachment; filename="${downloadName(download)}"` : 'inline')
  headers.set('x-frame-options', 'SAMEORIGIN')
  headers.set('content-security-policy', "frame-ancestors 'self'")
  headers.set('cache-control', 'private, max-age=300')
  headers.set('accept-ranges', 'bytes')
  return headers
}

function localPdfPath(name: string): string | null {
  if (!/^[a-z0-9]{8,40}-[a-z0-9]{6,12}\.pdf$/.test(name)) return null
  return path.join(process.cwd(), 'public', 'topic-docs', name)
}

async function pageList(bytes: Uint8Array): Promise<string[]> {
  const { PDFParse } = await import('pdf-parse')
  const parser = new PDFParse({ data: bytes })
  try {
    const result = await parser.getText()
    const listed = Array.isArray(result?.pages)
      ? result.pages.map((page: { text?: string }) => (page?.text || '').replace(/\s+/g, ' ').trim().slice(0, 20000))
      : []
    if (listed.some((page: string) => page.length > 0)) return listed
    return String(result?.text || '').split('\f').map((page) => page.replace(/\s+/g, ' ').trim().slice(0, 20000))
  } finally {
    await parser.destroy().catch(() => undefined)
  }
}

async function localPdf(file: string, range: string | null, download = false) {
  const info = await stat(file).catch(() => null)
  if (!info?.isFile() || info.size > 20_000_000) return new NextResponse('That PDF could not be opened.', { status: 404 })
  if (download) {
    const headers = viewerHeaders(file)
    headers.set('content-length', String(info.size))
    const stream = Readable.toWeb(createReadStream(file)) as ReadableStream
    return new NextResponse(stream, { status: 200, headers })
  }
  const headers = viewerHeaders()
  let start = 0
  let end = info.size - 1
  let status = 200
  if (range) {
    const match = /^bytes=(\d+)-(\d*)$/.exec(range.split(',')[0].trim())
    if (!match) return new NextResponse(null, { status: 416, headers: { 'content-range': `bytes */${info.size}` } })
    start = Number(match[1])
    end = match[2] ? Number(match[2]) : info.size - 1
    if (!Number.isFinite(start) || !Number.isFinite(end) || start >= info.size || end < start) {
      return new NextResponse(null, { status: 416, headers: { 'content-range': `bytes */${info.size}` } })
    }
    end = Math.min(end, info.size - 1)
    status = 206
    headers.set('content-range', `bytes ${start}-${end}/${info.size}`)
  }
  headers.set('content-length', String(end - start + 1))
  const stream = Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream
  return new NextResponse(stream, { status, headers })
}

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.id) return new NextResponse('Unauthorized', { status: 401 })
  const requestUrl = new URL(request.url)
  const localName = requestUrl.searchParams.get('file') || ''
  const pages = requestUrl.searchParams.get('pages') === '1'
  const download = requestUrl.searchParams.get('dl') === '1'
  if (localName) {
    const file = localPdfPath(localName)
    if (!file) return new NextResponse('That file is not a PDF.', { status: 400 })
    if (pages) {
      const bytes = await readFile(file).catch(() => null)
      if (!bytes || bytes.length > 20_000_000) return NextResponse.json({ pages: [] })
      const list = await pageList(bytes).catch(() => [])
      return NextResponse.json({ pages: list })
    }
    return localPdf(file, request.headers.get('range'), download)
  }
  const raw = requestUrl.searchParams.get('url') || ''
  try {
    const target = await pdfTarget(raw)
    const range = request.headers.get('range')
    const serveFile = async (file: string) => {
      if (pages) {
        const bytes = await readFile(file).catch(() => null)
        if (!bytes || bytes.length > 20_000_000) return NextResponse.json({ pages: [] })
        const list = await pageList(bytes).catch(() => [])
        return NextResponse.json({ pages: list })
      }
      return localPdf(file, range, download)
    }
    const cached = await readCachedPdf(target.toString())
    if (cached) return serveFile(cached)
    const upstream = await openPdf(target, pages || download ? null : range)
    const type = (upstream?.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
    const direct = Boolean(upstream && (upstream.ok || upstream.status === 206) && (type === 'application/pdf' || type === 'application/x-pdf'))
    if (!upstream || !direct) {
      await upstream?.body?.cancel().catch(() => undefined)
      const file = await ensureOpenPdf(target.toString())
      if (!file) return new NextResponse('That PDF could not be opened.', { status: 502 })
      return serveFile(file)
    }
    const length = Number(upstream.headers.get('content-length') || 0)
    if (length > MAX_BYTES) {
      await upstream.body?.cancel().catch(() => undefined)
      return new NextResponse('That PDF is too large to show.', { status: 400 })
    }
    if (pages) {
      const bytes = new Uint8Array(await upstream.arrayBuffer())
      if (bytes.length > MAX_BYTES) return NextResponse.json({ pages: [] })
      const list = await pageList(bytes).catch(() => [])
      return NextResponse.json({ pages: list })
    }
    const headers = viewerHeaders(download ? target.pathname : '')
    for (const name of ['content-length', 'content-range']) {
      const value = upstream.headers.get(name)
      if (value) headers.set(name, value)
    }
    return new NextResponse(upstream.body, { status: upstream.status, headers })
  } catch (error) {
    const message = error instanceof PublicUrlError ? error.message : 'That PDF could not be opened.'
    return new NextResponse(message, { status: 400 })
  }
}
