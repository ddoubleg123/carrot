import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { recordDwell } from '@/lib/recordInterest'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ ok: false }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const postId = String(body?.postId || '')
  const ms = Number(body?.ms)
  if (!postId || !Number.isFinite(ms)) return NextResponse.json({ ok: false }, { status: 400 })
  await recordDwell(userId, postId, Math.max(0, Math.min(ms, 120_000))).catch((error) => {
    console.error('[interest] dwell', error)
  })
  return NextResponse.json({ ok: true })
}
