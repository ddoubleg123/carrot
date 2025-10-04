import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { auth } from '@/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// DELETE /api/patches/[handle]
export async function DELETE(_req: Request, ctx: { params: Promise<{ handle: string }> }) {
  try {
    const { handle } = await ctx.params
    const session: any = await auth().catch(() => null)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const patch = await prisma.patch.findUnique({ where: { handle }, select: { id: true, createdBy: true } })
    if (!patch) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })

    // Check admin: creator or has member role=admin
    const isCreator = patch.createdBy === session.user.id
    const membership = await prisma.patchMember.findUnique({
      where: { patch_user_member_unique: { patchId: patch.id, userId: session.user.id } },
      select: { role: true }
    }).catch(() => null as any)
    const isAdmin = membership?.role === 'admin'

    if (!isCreator && !isAdmin) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    await prisma.patch.delete({ where: { id: patch.id } })
    return NextResponse.json({ success: true, handle })
  } catch (e: any) {
    console.error('[PATCH DELETE] error', e)
    return NextResponse.json({ success: false, error: e?.message || 'server error' }, { status: 500 })
  }
}
