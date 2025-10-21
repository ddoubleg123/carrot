/**
 * Stop discovery endpoint
 */

import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { discoveryStateManager } from '@/lib/discovery/streaming'

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

    // Stop discovery state
    discoveryStateManager.updateState({ 
      isActive: false, 
      isPaused: false,
      currentStatus: 'Discovery stopped'
    })

    return NextResponse.json({
      success: true,
      message: 'Discovery stopped'
    })

  } catch (error) {
    console.error('[DiscoveryStop] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
