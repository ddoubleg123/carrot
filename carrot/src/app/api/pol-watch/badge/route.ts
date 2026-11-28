import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { deskById } from '@/lib/curator/desks'

export const dynamic = 'force-dynamic'

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

export async function GET() {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ count: 0 })
  const viewer = await prisma.user.findUnique({ where: { id: userId }, select: { metadata: true } })
  const opened = asRecord(viewer?.metadata).polWatchOpenedAt
  const since = typeof opened === 'string' ? new Date(opened) : new Date(0)
  const desk = deskById('member-card')
  const member = desk
    ? await prisma.user.findUnique({ where: { username: desk.username }, select: { id: true } }).catch(() => null)
    : null
  const count = await prisma.post.count({
    where: {
      createdAt: { gt: since },
      OR: [
        { bucket: 'pol-watch' },
        { User: { email: { endsWith: '@office.carrot.invalid' } } },
        ...(member ? [{ userId: member.id }] : [])
      ]
    }
  }).catch(() => 0)
  return NextResponse.json({ count })
}

export async function POST() {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const stamp = JSON.stringify(new Date().toISOString())
  await prisma.$executeRaw`
    UPDATE "User"
    SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{polWatchOpenedAt}', ${stamp}::jsonb, true)
    WHERE id = ${userId}
  `
  return NextResponse.json({ ok: true })
}
