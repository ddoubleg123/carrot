import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { OPEN_EVIDENCE_V2 } from '@/lib/flags'
import { generateGuideSnapshot } from '@/lib/discovery/planner'

export const dynamic = 'force-dynamic'

export async function POST(request: Request, { params }: { params: Promise<{ handle: string }> }) {
  if (!OPEN_EVIDENCE_V2) {
    return NextResponse.json({ error: 'Guide refresh is disabled' }, { status: 403 })
  }

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { handle } = await params
  if (!handle) {
    return NextResponse.json({ error: 'Patch handle is required' }, { status: 400 })
  }

  const patch = await prisma.patch.findUnique({
    where: { handle },
    select: {
      id: true,
      createdBy: true,
      title: true,
      tags: true,
      entity: true
    }
  })

  if (!patch) {
    return NextResponse.json({ error: 'Patch not found' }, { status: 404 })
  }

  const isOwner = patch.createdBy === session.user.id
  const adminMembership = await prisma.patchMember.findFirst({
    where: {
      patchId: patch.id,
      userId: session.user.id,
      role: 'admin'
    },
    select: { id: true }
  })

  if (!isOwner && !adminMembership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const entity = (patch.entity ?? {}) as { name?: string; aliases?: string[] }
  const topic = entity?.name && entity.name.trim().length ? entity.name.trim() : patch.title
  const aliases = Array.isArray(entity?.aliases) && entity.aliases.length
    ? entity.aliases
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        .map((value) => value.trim())
    : patch.tags
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        .map((value) => value.trim())

  try {
    const guide = await generateGuideSnapshot(topic, aliases)
    await prisma.patch.update({
      where: { id: patch.id },
      data: { guide: guide as unknown as Prisma.JsonObject }
    })

    return NextResponse.json({ success: true, guide })
  } catch (error) {
    console.error('[RefreshGuide] Failed to refresh guide', { handle, error })
    return NextResponse.json({ error: 'Failed to refresh guide' }, { status: 500 })
  }
}
