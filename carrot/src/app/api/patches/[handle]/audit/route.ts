import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAuditEvents } from '@/lib/redis/discovery'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: { handle: string } }) {
  try {
    const searchParams = new URL(request.url).searchParams
    const handle = params.handle

    if (!handle) {
      return NextResponse.json({ error: 'Missing patch handle' }, { status: 400 })
    }

    const patch = await prisma.patch.findUnique({ where: { handle } })
    if (!patch) {
      return NextResponse.json({ error: 'Patch not found' }, { status: 404 })
    }

    const offset = parseInt(searchParams.get('cursor') ?? '0', 10)
    const limit = parseInt(searchParams.get('limit') ?? '100', 10)

    const { items, nextOffset, hasMore } = await getAuditEvents(patch.id, { offset, limit })

    if (items.length === 0 && offset === 0) {
      const fallback = await prisma.discoveryAudit.findMany({
        where: { patchId: patch.id },
        orderBy: { createdAt: 'desc' },
        take: limit
      })

      return NextResponse.json({
        items: fallback,
        cursor: fallback.length,
        hasMore: fallback.length === limit
      })
    }

    return NextResponse.json({
      items,
      cursor: nextOffset,
      hasMore
    })
  } catch (error) {
    console.error('[Audit API] Failed to fetch audit events', error)
    return NextResponse.json({ error: 'Failed to fetch audit events' }, { status: 500 })
  }
}
