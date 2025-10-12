import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { auth } from '@/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// DELETE /api/patches/[handle]
export async function DELETE(_req: Request, ctx: { params: Promise<{ handle: string }> }) {
  try {
    const { handle } = await ctx.params
    console.log('[PATCH DELETE] Starting delete for handle:', handle)
    
    const session: any = await auth().catch(() => null)
    if (!session?.user?.id) {
      console.log('[PATCH DELETE] No session found')
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[PATCH DELETE] Session user ID:', session.user.id)

    const patch = await prisma.patch.findUnique({ 
      where: { handle }, 
      select: { id: true, createdBy: true, name: true } 
    })
    
    if (!patch) {
      console.log('[PATCH DELETE] Patch not found for handle:', handle)
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    }

    console.log('[PATCH DELETE] Found patch:', { id: patch.id, name: patch.name, createdBy: patch.createdBy })

    // Check admin: creator or has member role=admin
    const isCreator = patch.createdBy === session.user.id
    console.log('[PATCH DELETE] Is creator:', isCreator)
    
    const membership = await prisma.patchMember.findUnique({
      where: { patch_user_member_unique: { patchId: patch.id, userId: session.user.id } },
      select: { role: true }
    }).catch(() => null as any)
    
    const isAdmin = membership?.role === 'admin'
    console.log('[PATCH DELETE] Is admin:', isAdmin, 'Membership:', membership)

    if (!isCreator && !isAdmin) {
      console.log('[PATCH DELETE] User not authorized to delete patch')
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    console.log('[PATCH DELETE] Proceeding with deletion...')
    await prisma.patch.delete({ where: { id: patch.id } })
    console.log('[PATCH DELETE] Patch deleted successfully')
    
    return NextResponse.json({ success: true, handle })
  } catch (e: any) {
    console.error('[PATCH DELETE] error', e)
    return NextResponse.json({ success: false, error: e?.message || 'server error' }, { status: 500 })
  }
}
