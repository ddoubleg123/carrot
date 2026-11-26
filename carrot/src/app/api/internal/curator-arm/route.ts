import { NextResponse } from 'next/server'
import { armCurator } from '@/lib/curator/hunt'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const onRender = process.env.RENDER === 'true' || Boolean(process.env.RENDER_SERVICE_ID)
  if (!onRender) return NextResponse.json({ ok: false, idle: true })
  const host = request.headers.get('host') || ''
  const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host)
  const secret = process.env.CURATOR_SECRET || process.env.INGEST_WORKER_SECRET || ''
  const header = request.headers.get('x-curator-secret') || ''
  if (!local && (!secret || header !== secret)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  armCurator()
  return NextResponse.json({ ok: true })
}
