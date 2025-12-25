/**
 * Stop discovery endpoint
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { discoveryStateManager } from '@/lib/discovery/streaming'
import { getActiveRun, clearActiveRun, setRunState } from '@/lib/redis/discovery'
import { stopOpenEvidenceRun } from '@/lib/discovery/engine'
import prisma from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, { params }: { params: Promise<{ handle: string }> }) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { handle } = await params
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

    // Always set run state to suspended, even if we can't find the active run
    // This ensures the engine stops if it's running (engineV21 checks this state)
    await setRunState(patch.id, 'suspended').catch(() => undefined)

    if (runId) {
      const stopped = stopOpenEvidenceRun(runId)
      if (!stopped) {
        console.warn(`[DiscoveryStop] Run ${runId} not found in active runs, but state set to suspended`)
      }
    } else {
      console.warn(`[DiscoveryStop] No active run found for patch ${patch.id}, but state set to suspended`)
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
