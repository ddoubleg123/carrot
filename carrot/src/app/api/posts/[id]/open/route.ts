import { NextResponse } from 'next/server'
import { auth } from '../../../../../auth'
import { recordTaste } from '@/lib/tasteRecord'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const userId = (session as { user?: { id?: string } } | null)?.user?.id
  if (!userId) return NextResponse.json({ ok: false })
  const { id } = await ctx.params
  await recordTaste(userId, id, 'open').catch((error) => {
    console.error('[taste] open', error)
  })
  return NextResponse.json({ ok: true })
}
