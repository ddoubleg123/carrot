import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function patchFor(handle: string) {
  return prisma.patch.findUnique({
    where: { handle },
    select: { id: true, createdBy: true }
  })
}

export async function POST(_request: Request, { params }: { params: Promise<{ handle: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { handle } = await params
  const patch = await patchFor(handle)
  if (!patch) return NextResponse.json({ error: 'Group not found' }, { status: 404 })
  if (patch.createdBy !== session.user.id) {
    await prisma.patchMember.upsert({
      where: { patch_user_member_unique: { patchId: patch.id, userId: session.user.id } },
      update: {},
      create: { patchId: patch.id, userId: session.user.id, role: 'member' }
    })
  }
  return NextResponse.json({ member: true })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ handle: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { handle } = await params
  const patch = await patchFor(handle)
  if (!patch) return NextResponse.json({ error: 'Group not found' }, { status: 404 })
  if (patch.createdBy === session.user.id) {
    return NextResponse.json({ error: 'You started this group, so you stay in it. Delete it from Settings to close it.' }, { status: 400 })
  }
  await prisma.patchMember.deleteMany({
    where: { patchId: patch.id, userId: session.user.id }
  })
  return NextResponse.json({ member: false })
}

export async function GET(_request: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  const patch = await patchFor(handle)
  if (!patch) return NextResponse.json({ error: 'Group not found' }, { status: 404 })
  const members = await prisma.patchMember.findMany({
    where: { patchId: patch.id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          image: true,
          profilePhoto: true,
          username: true
        }
      }
    },
    orderBy: { joinedAt: 'desc' },
    take: 24
  })
  return NextResponse.json({
    followers: members.map((member) => ({
      id: member.id,
      user: {
        id: member.user.id,
        name: member.user.name,
        image: member.user.image,
        profilePhoto: member.user.profilePhoto,
        username: member.user.username
      }
    }))
  })
}
