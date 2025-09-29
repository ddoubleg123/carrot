import { NextResponse } from 'next/server'
import { TrainingStore } from '@/lib/ai-agents/trainingStore'
import { startTrainingOrchestrator } from '@/lib/ai-agents/trainingOrchestrator'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(()=>({})) as any
    const agentIds: string[] | undefined = Array.isArray(body.agentIds) ? body.agentIds : undefined
    const pause: boolean = !!body.pause
    const all: boolean = !!body.all

    const planIds = TrainingStore.listPlanIds()
    let changed = 0

    for (const id of planIds) {
      const plan = TrainingStore.getPlan(id)
      if (!plan) continue
      if (!all && agentIds && !agentIds.includes(plan.agentId)) continue
      const before = !!plan.options.pauseDiscovery
      plan.options.pauseDiscovery = pause
      // Apply pacing boost when paused; restore if resuming and meta exists
      const DEFAULT_FEED_ONLY = { throttleMs: 1500, maxTasksPerTick: 3 }
      plan.meta = plan.meta || {}
      if (pause) {
        if (!plan.meta.origPacing) {
          plan.meta.origPacing = {
            throttleMs: plan.options.throttleMs,
            maxTasksPerTick: plan.options.maxTasksPerTick,
          }
        }
        plan.options.throttleMs = DEFAULT_FEED_ONLY.throttleMs
        plan.options.maxTasksPerTick = DEFAULT_FEED_ONLY.maxTasksPerTick
      } else if (plan.meta.origPacing) {
        plan.options.throttleMs = plan.meta.origPacing.throttleMs
        plan.options.maxTasksPerTick = plan.meta.origPacing.maxTasksPerTick
        delete plan.meta.origPacing
      }
      TrainingStore.updatePlan(plan)
      if (before !== pause) changed++
    }

    startTrainingOrchestrator()
    return NextResponse.json({ ok: true, changed })
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || 'server error' }, { status: 500 })
  }
}
