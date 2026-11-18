import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function votesFrom(metadata: unknown) {
  const current = metadata && typeof metadata === 'object'
    ? (metadata as { memberVotes?: { up?: unknown; down?: unknown } }).memberVotes
    : undefined
  return {
    up: Array.isArray(current?.up) ? current.up.filter((id): id is string => typeof id === 'string') : [],
    down: Array.isArray(current?.down) ? current.down.filter((id): id is string => typeof id === 'string') : []
  }
}

function toggle(list: string[], userId: string) {
  return list.includes(userId) ? list.filter((id) => id !== userId) : [...list, userId]
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ handle: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { handle } = await params
  const body = await request.json().catch(() => ({}))
  const contentId = typeof body?.id === 'string' ? body.id : ''
  const vote = body?.vote === 'down' ? 'down' : body?.vote === 'up' ? 'up' : ''
  if (!contentId || !vote) {
    return NextResponse.json({ error: 'Choose up or down.' }, { status: 400 })
  }

  const patch = await prisma.patch.findUnique({
    where: { handle },
    select: { id: true, createdBy: true }
  })
  if (!patch) return NextResponse.json({ error: 'Group not found' }, { status: 404 })

  const member = patch.createdBy === session.user.id || Boolean(await prisma.patchMember.findUnique({
    where: { patch_user_member_unique: { patchId: patch.id, userId: session.user.id } },
    select: { id: true }
  }))
  if (!member) return NextResponse.json({ error: 'Permission denied' }, { status: 403 })

  const content = await prisma.discoveredContent.findFirst({
    where: { id: contentId, patchId: patch.id },
    select: { id: true, metadata: true }
  })
  if (!content) return NextResponse.json({ error: 'Source not found in this group' }, { status: 404 })

  const metadata = content.metadata && typeof content.metadata === 'object' && !Array.isArray(content.metadata)
    ? { ...(content.metadata as Record<string, unknown>) }
    : {}
  const votes = votesFrom(metadata)
  if (vote === 'up') {
    votes.up = toggle(votes.up, session.user.id)
    votes.down = votes.down.filter((id) => id !== session.user.id)
  } else {
    votes.down = toggle(votes.down, session.user.id)
    votes.up = votes.up.filter((id) => id !== session.user.id)
  }
  metadata.memberVotes = votes

  await prisma.discoveredContent.update({
    where: { id: content.id },
    data: { metadata: metadata as Prisma.JsonObject }
  })

  return NextResponse.json({
    id: content.id,
    up: votes.up.length,
    down: votes.down.length,
    trust: votes.up.length - votes.down.length,
    mine: votes.up.includes(session.user.id) ? 'up' : votes.down.includes(session.user.id) ? 'down' : null
  })
}
