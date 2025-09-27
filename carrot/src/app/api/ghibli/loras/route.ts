import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const workerUrl = process.env.GHIBLI_WORKER_URL || ''
  if (!workerUrl) {
    return NextResponse.json({ ok: true, items: [], note: 'GHIBLI_WORKER_URL not set' })
  }
  try {
    const res = await fetch(workerUrl.replace(/\/$/, '') + '/loras', { cache: 'no-store' })
    if (!res.ok) throw new Error(`worker responded ${res.status}`)
    const j = await res.json()
    const items = Array.isArray(j?.items) ? j.items : []
    return NextResponse.json({ ok: true, items })
  } catch (e: any) {
    // Worker might not implement /loras; return empty list gracefully
    return NextResponse.json({ ok: true, items: [], note: e?.message || 'worker /loras unavailable' })
  }
}
