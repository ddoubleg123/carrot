import { NextResponse } from 'next/server'
import { stat, open } from 'fs/promises'
import { basename, resolve } from 'path'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Streams files from /tmp or project-relative tmp dirs for preview/download
export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const p = url.searchParams.get('path')
    if (!p) return new NextResponse('Missing path', { status: 400 })

    // Strictly allow only /tmp or project .next/tmp or public/tmp
    const abs = resolve(p.startsWith('/') ? p : `/tmp/${p}`)
    if (!abs.startsWith('/tmp/')) {
      return new NextResponse('Forbidden path', { status: 403 })
    }

    const st = await stat(abs)
    const fh = await open(abs, 'r')
    const stream = (fh as any).createReadStream()
    const headers = new Headers()
    headers.set('content-type', guessContentType(abs))
    headers.set('content-length', String(st.size))
    headers.set('content-disposition', `inline; filename="${basename(abs)}"`)
    headers.set('cache-control', 'public, max-age=86400')
    return new NextResponse(stream as any, { status: 200, headers })
  } catch (e: any) {
    return new NextResponse('Not found', { status: 404 })
  }
}

function guessContentType(name: string) {
  const n = name.toLowerCase()
  if (n.endsWith('.mp4')) return 'video/mp4'
  if (n.endsWith('.webm')) return 'video/webm'
  if (n.endsWith('.png')) return 'image/png'
  if (n.endsWith('.jpg') || n.endsWith('.jpeg')) return 'image/jpeg'
  if (n.endsWith('.gif')) return 'image/gif'
  if (n.endsWith('.webp')) return 'image/webp'
  if (n.endsWith('.svg')) return 'image/svg+xml'
  return 'application/octet-stream'
}
