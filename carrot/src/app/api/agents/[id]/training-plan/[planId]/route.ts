import { NextResponse } from 'next/server'
import { TrainingStore } from '@/lib/ai-agents/trainingStore'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/agents/[id]/training-plan/[planId]
export async function GET(req: Request, ctx: { params: Promise<{ id: string; planId: string }> }) {
  try {
    const { planId } = await ctx.params
    const plan = TrainingStore.getPlan(planId)
    if (!plan) return NextResponse.json({ ok: false, error: 'plan not found' }, { status: 404 })
    const tasks = TrainingStore.listTasks(planId)
    return NextResponse.json({ ok: true, plan, tasks })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'server error' }, { status: 500 })
  }
}
