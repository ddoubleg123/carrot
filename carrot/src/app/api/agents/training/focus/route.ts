import { NextResponse } from 'next/server'
import { TrainingStore } from '@/lib/ai-agents/trainingStore'
import { startTrainingOrchestrator } from '@/lib/ai-agents/trainingOrchestrator'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/agents/training/focus { percent: 0..100 }
// 0 = discovery-heavy, 100 = feeding-only
export async function POST(req: Request) {
  try {
    const body: any = await req.json().catch(()=>({}))
    let percent = typeof body?.percent === 'number' ? body.percent : 50
    if (!isFinite(percent)) percent = 50
    percent = Math.max(0, Math.min(100, Math.round(percent)))

    const feedBias = percent / 100
    const discoveryBias = 1 - feedBias

    // Map biases to pacing values
    // throttleMs: 4000 (discovery) -> 1500 (feeding)
    const calcThrottle = Math.round(4000 * discoveryBias + 1500 * feedBias)
    // maxTasksPerTick: 1 (discovery) -> 3 (feeding)
    const calcMaxTasks = Math.max(1, Math.round(1 * discoveryBias + 3 * feedBias))

    const planIds = TrainingStore.listPlanIds()
    let updated = 0
    for (const id of planIds) {
      const plan = TrainingStore.getPlan(id)
      if (!plan) continue
      plan.meta = plan.meta || {}

      // Save original pacing if not saved yet
      if (!plan.meta.origPacing) {
        plan.meta.origPacing = {
          throttleMs: plan.options.throttleMs,
          maxTasksPerTick: plan.options.maxTasksPerTick,
        }
      }

      // Apply pacing based on slider
      plan.options.throttleMs = calcThrottle
      plan.options.maxTasksPerTick = calcMaxTasks

      // Strict pause when near 100% feed-only
      if (percent >= 90) {
        plan.options.pauseDiscovery = true
      } else if (percent <= 10) {
        plan.options.pauseDiscovery = false
      } else {
        // middle zone: allow discovery, but pacing favors feeding
        plan.options.pauseDiscovery = false
      }

      TrainingStore.updatePlan(plan)
      updated++
    }

    startTrainingOrchestrator()
    return NextResponse.json({ ok: true, percent, updated })
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || 'server error' }, { status: 500 })
  }
}
