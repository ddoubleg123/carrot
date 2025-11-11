/**
 * Pause discovery endpoint
 */

import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { discoveryStateManager } from '@/lib/discovery/streaming'
import { getRunState, setRunState } from '@/lib/redis/discovery'

export const dynamic = 'force-dynamic'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ handle: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { handle } = await params

    const patch = await prisma.patch.findUnique({
      where: { handle },
      select: { id: true }
    })

    if (!patch) {
      return NextResponse.json({ error: 'Patch not found' }, { status: 404 })
    }

    const currentRunState = await getRunState(patch.id)
    const nextState = currentRunState === 'paused' ? 'live' : 'paused'

    // Pause discovery state
    discoveryStateManager.updateState({ isPaused: nextState === 'paused' })

    await setRunState(patch.id, nextState).catch((error) => {
      console.warn('[DiscoveryPause] Failed to update run state', error)
    })

    return NextResponse.json({
      success: true,
      message: nextState === 'paused' ? 'Discovery paused' : 'Discovery resumed',
      runState: nextState
    })

  } catch (error) {
    console.error('[DiscoveryPause] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
