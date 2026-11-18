import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { saveGroupCoverFile } from '@/lib/groups/cover'
import { Prisma } from '@prisma/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request, context: { params: Promise<{ handle: string }> }) {
  const session = await auth().catch(() => null)
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Sign in to change this picture.' }, { status: 401 })

  const { handle } = await context.params
  const patch = await prisma.patch.findUnique({
    where: { handle },
    select: { id: true, createdBy: true, entity: true }
  })
  if (!patch) return NextResponse.json({ error: 'Group not found.' }, { status: 404 })

  const membership = await prisma.patchMember.findUnique({
    where: { patch_user_member_unique: { patchId: patch.id, userId } },
    select: { role: true }
  }).catch(() => null)
  if (patch.createdBy !== userId && membership?.role !== 'admin') {
    return NextResponse.json({ error: 'Only the group admin can change this picture.' }, { status: 403 })
  }

  const form = await request.formData().catch(() => null)
  const file = form?.get('image')
  if (!(file instanceof File)) return NextResponse.json({ error: 'Choose a photo.' }, { status: 400 })
  const bytes = Buffer.from(await file.arrayBuffer())
  let cover = ''
  try {
    cover = await saveGroupCoverFile(patch.id, bytes, file.type)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'That photo could not be saved.' }, { status: 400 })
  }

  const base = patch.entity && typeof patch.entity === 'object' && !Array.isArray(patch.entity)
    ? { ...(patch.entity as Record<string, unknown>) }
    : {}
  await prisma.patch.update({
    where: { id: patch.id },
    data: {
      entity: {
        ...base,
        cover,
        coverSource: 'member',
        coverCheckedAt: new Date().toISOString()
      } as Prisma.JsonObject
    }
  })
  return NextResponse.json({ cover })
}
