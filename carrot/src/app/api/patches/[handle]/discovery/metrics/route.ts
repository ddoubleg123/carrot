import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import {
  getPatchMetricsSnapshot,
  getRunMetricsSnapshot
} from '@/lib/redis/discovery'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  try {
    const { handle } = await params
    const searchParams = request.nextUrl.searchParams
    const runId = searchParams.get('runId')

    const patch = await prisma.patch.findUnique({
      where: { handle },
      select: { id: true }
    })

    if (!patch) {
      return NextResponse.json({ error: 'Patch not found' }, { status: 404 })
    }

    const snapshot = runId
      ? await getRunMetricsSnapshot(runId)
      : await getPatchMetricsSnapshot(patch.id)

    if (!snapshot) {
      return NextResponse.json({ snapshot: null }, { status: 200 })
    }

    return NextResponse.json({ snapshot }, { status: 200 })
  } catch (error) {
    console.error('[Discovery Metrics] Failed to load metrics snapshot', error)
    return NextResponse.json(
      { error: 'Failed to load metrics snapshot' },
      { status: 500 }
    )
  }
}

