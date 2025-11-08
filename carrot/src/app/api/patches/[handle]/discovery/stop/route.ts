/**
 * Stop discovery endpoint
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { discoveryStateManager } from '@/lib/discovery/streaming'
import { getActiveRun, clearActiveRun } from '@/lib/redis/discovery'
import { stopOpenEvidenceRun } from '@/lib/discovery/engine'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, context: { params: { handle: string } }) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const handle = context.params?.handle
    if (!handle) {
      return NextResponse.json({ error: 'Missing patch handle' }, { status: 400 })
    }

    const patch = await prisma.patch.findUnique({ where: { handle }, select: { id: true } })
    if (!patch) {
      return NextResponse.json({ error: 'Patch not found' }, { status: 404 })
    }

    const body = await request.json().catch(() => ({} as Record<string, any>))
    const urlRunId = request.nextUrl.searchParams.get('runId')
    let runId = body?.runId || urlRunId || undefined

    if (!runId) {
      runId = await getActiveRun(patch.id) || undefined
    }

    if (!runId) {
      return NextResponse.json({ error: 'No active discovery run found' }, { status: 404 })
    }

    const stopped = stopOpenEvidenceRun(runId)
    if (!stopped) {
      return NextResponse.json({ error: 'Discovery run is not active' }, { status: 409 })
    }

    // Stop discovery state
    discoveryStateManager.updateState({ 
      isActive: false, 
      isPaused: false,
      currentStatus: 'Discovery stopped'
    })

    await clearActiveRun(patch.id).catch(() => undefined)

    return NextResponse.json({
      success: true,
      message: 'Discovery stop requested',
      runId
    })

  } catch (error) {
    console.error('[DiscoveryStop] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
