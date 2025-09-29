import { NextResponse } from 'next/server'
import { TrainingStore } from '@/lib/ai-agents/trainingStore'
import { startTrainingOrchestrator } from '@/lib/ai-agents/trainingOrchestrator'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/agents/[id]/training-plan
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const body = await req.json()
    const topics: string[] = Array.isArray(body.topics) ? body.topics : []
    const perTopicMax: number = body.options?.perTopicMax ?? 200
    const sourceTypes: string[] = body.options?.sourceTypes ?? ['wikipedia','arxiv','academic','books','news','github','stackoverflow','pubmed']
    const throttleMs: number | undefined = body.options?.throttleMs
    const maxTasksPerTick: number | undefined = body.options?.maxTasksPerTick
    const verifyWithDeepseek: boolean | undefined = body.options?.verifyWithDeepseek
    if (!topics.length) return NextResponse.json({ error: 'topics required' }, { status: 400 })

    const plan = TrainingStore.createPlan(id, topics, { perTopicMax, sourceTypes, throttleMs, maxTasksPerTick, verifyWithDeepseek }, sourceTypes)
    startTrainingOrchestrator()
    return NextResponse.json({ ok: true, planId: plan.id, plan })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'server error' }, { status: 500 })
  }
}
