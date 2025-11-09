/**
 * Start discovery endpoint
 */

import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

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

    // Get patch details
    const patch = await prisma.patch.findUnique({
      where: { handle },
      select: {
        id: true,
        title: true,
        description: true,
        tags: true,
        createdBy: true
      }
    })

    if (!patch) {
      return NextResponse.json({ error: 'Patch not found' }, { status: 404 })
    }

    // Check permissions
    const isOwner = patch.createdBy === session.user.id
    if (!isOwner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Start discovery (this would be implemented with the orchestrator)
    console.log('[DiscoveryStart] Starting discovery for patch:', handle)

    return NextResponse.json({
      success: true,
      message: 'Discovery started',
      patchId: patch.id
    })

  } catch (error) {
    console.error('[DiscoveryStart] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
