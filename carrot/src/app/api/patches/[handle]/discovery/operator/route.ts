import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { getActiveRun } from '@/lib/redis/discovery'
import { publishAuditEvent } from '@/lib/discovery/eventBus'
import { pushAuditEvent } from '@/lib/redis/discovery'

export const dynamic = 'force-dynamic'

const ALLOWED_ACTIONS = new Set(['pin_seed', 'nuke_host', 'boost_hook', 'skip_angle', 'add_seed'])

export async function POST(request: NextRequest, { params }: { params: Promise<{ handle: string }> }) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { handle } = await params
    const patch = await prisma.patch.findUnique({
      where: { handle },
      select: { id: true, title: true }
    })

    if (!patch) {
      return NextResponse.json({ error: 'Patch not found' }, { status: 404 })
    }

    const payload = await request.json().catch(() => ({}))
    const action = typeof payload?.action === 'string' ? payload.action.trim() : ''
    const notes = typeof payload?.notes === 'string' ? payload.notes.trim() : ''
    const target = typeof payload?.target === 'string' ? payload.target.trim() : ''

    if (!ALLOWED_ACTIONS.has(action)) {
      return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
    }

    const runId = (await getActiveRun(patch.id)) ?? `manual:${Date.now()}`
    const now = new Date()

    const record = await prisma.discoveryAudit.create({
      data: {
        patchId: patch.id,
        runId,
        step: 'operator_action',
        status: 'pending',
        provider: 'operator',
        decisions: {
          action,
          target,
          notes,
          userId: session.user.id,
          userEmail: session.user.email ?? null
        },
        meta: {
          title: patch.title,
          handle,
          action,
          target,
          notes,
          initiatedAt: now.toISOString()
        },
        ts: now
      }
    })

    const eventPayload = {
      ...record,
      id: record.id,
      ts: record.ts,
      step: record.step,
      status: record.status
    }

    publishAuditEvent(patch.id, eventPayload)
    try {
      await pushAuditEvent(patch.id, eventPayload)
    } catch (redisError) {
      console.warn('[OperatorAction] Failed to push event to Redis', redisError)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[OperatorAction] Failed to record operator action', error)
    return NextResponse.json({ error: 'Failed to record operator action' }, { status: 500 })
  }
}


