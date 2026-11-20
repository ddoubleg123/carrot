import { NextResponse } from 'next/server'
import { clipOnceJob, latestOrSaved, startClipOnce } from '@/lib/learn/clipOnce'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

function local(request: Request): boolean {
  const host = new URL(request.url).hostname
  return host === 'localhost' || host === '127.0.0.1'
}

export async function GET(request: Request) {
  if (!local(request)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const id = new URL(request.url).searchParams.get('id') || ''
  const job = id ? clipOnceJob(id) : await latestOrSaved()
  if (!job) return NextResponse.json({ job: null })
  return NextResponse.json({ job })
}

export async function POST(request: Request) {
  if (!local(request)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const body = await request.json().catch(() => ({}))
  const useSaved = body?.useSaved === true
  const url = typeof body?.url === 'string' ? body.url.trim() : ''
  if (!useSaved) {
    if (body?.rights !== true) return NextResponse.json({ error: 'Confirm you have the rights to clip this video.' }, { status: 400 })
    if (!/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(url)) {
      return NextResponse.json({ error: 'Paste a YouTube link.' }, { status: 400 })
    }
  }
  const running = await latestOrSaved()
  if (running?.status === 'running') return NextResponse.json({ job: running })
  const job = await startClipOnce(useSaved ? { useSaved: true } : { url })
  return NextResponse.json({ job })
}
