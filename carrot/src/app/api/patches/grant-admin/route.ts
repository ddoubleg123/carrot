import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const url = new URL(req.url)
    const qUser = url.searchParams.get('username')
    const body = await req.json().catch(() => null)
    const username = String(body?.username || qUser || '').trim() || 'daniel'

    // Find user by username OR email fallback
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: username },
          { email: username }
        ]
      },
      select: { id: true, username: true, email: true }
    })
    if (!user) return NextResponse.json({ success: false, error: `User not found: ${username}` }, { status: 404 })

    const patches = await prisma.patch.findMany({ select: { id: true, handle: true, title: true } })

    let updated = 0
    for (const p of patches) {
      // Upsert membership to admin
      const existing = await prisma.patchMember.findUnique({
        where: { patch_user_member_unique: { patchId: p.id, userId: user.id } }
      }).catch(()=>null as any)

      if (!existing) {
        await prisma.patchMember.create({ data: { patchId: p.id, userId: user.id, role: 'admin' } })
        updated++
      } else if (existing.role !== 'admin') {
        await prisma.patchMember.update({ where: { id: existing.id }, data: { role: 'admin' } })
        updated++
      }
    }

    return NextResponse.json({ success: true, username: username, totalPatches: patches.length, updated })
  } catch (e: any) {
    console.error('[PATCHES GRANT-ADMIN] error', e)
    return NextResponse.json({ success: false, error: e?.message || 'server error' }, { status: 500 })
  }
}
