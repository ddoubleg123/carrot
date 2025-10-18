import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Shared session store (same as stream endpoint)
const sessions = new Map<string, { active: boolean; count: number }>()

/**
 * Control endpoints for discovery
 * POST /api/patches/[handle]/discovery/control?action=start|pause|resume|stop
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { handle } = await params
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    // Get patch
    const patch = await prisma.patch.findUnique({
      where: { handle },
      select: { id: true }
    })

    if (!patch) {
      return NextResponse.json({ error: 'Patch not found' }, { status: 404 })
    }

    const sessionKey = `${patch.id}:${session.user.id}`

    switch (action) {
      case 'start':
      case 'resume':
        sessions.set(sessionKey, { active: true, count: sessions.get(sessionKey)?.count || 0 })
        return NextResponse.json({ success: true, action })

      case 'pause':
        const currentSession = sessions.get(sessionKey)
        if (currentSession) {
          currentSession.active = false
        }
        return NextResponse.json({ success: true, action })

      case 'stop':
        sessions.delete(sessionKey)
        return NextResponse.json({ success: true, action })

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    console.error('[Discovery Control] Error:', error)
    return NextResponse.json(
      { error: 'Failed to control discovery' },
      { status: 500 }
    )
  }
}

