/**
 * Pause discovery endpoint
 */

import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { DiscoveryState } from '@/lib/discovery/streaming'

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

    // Pause discovery state
    DiscoveryState.pause(handle)

    return NextResponse.json({
      success: true,
      message: 'Discovery paused'
    })

  } catch (error) {
    console.error('[DiscoveryPause] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
