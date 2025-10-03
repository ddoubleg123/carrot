import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const patches = await prisma.patch.findMany({
      include: {
        _count: { select: { members: true, posts: true, events: true, sources: true } },
        creator: { select: { id: true, name: true, username: true } }
      },
      orderBy: { createdAt: 'desc' }
    })
    return NextResponse.json({ success: true, total: patches.length, patches })
  } catch (e:any) {
    console.error('[PATCHES ALL] error', e)
    return NextResponse.json({ success: false, error: e?.message || 'server error' }, { status: 500 })
  }
}
