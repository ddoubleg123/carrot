import { NextResponse } from 'next/server'
import { TrainingStore } from '@/lib/ai-agents/trainingStore'
import { startTrainingOrchestrator } from '@/lib/ai-agents/trainingOrchestrator'
import { AgentRegistry } from '@/lib/ai-agents/agentRegistry'
import { FEATURED_AGENTS } from '@/lib/agents'

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

    // Ensure agent exists in DB; create from featured metadata if missing
    let agent = await AgentRegistry.getAgentById(id)
    if (!agent) {
      const featured = FEATURED_AGENTS.find(a => a.id === id)
      if (!featured) {
        return NextResponse.json({ ok: false, error: 'agent not found' }, { status: 404 })
      }
      await AgentRegistry.createAgent({
        name: featured.name,
        persona: featured.personality?.approach || `${featured.name} — ${featured.personality?.expertise || 'Expert'}`,
        domainExpertise: Array.isArray(featured.domains) ? featured.domains : [],
        metadata: {
          role: featured.personality?.expertise,
          avatar: featured.avatar,
          trainingEnabled: true,
        }
      })
      agent = await AgentRegistry.getAgentById(id)
    }

    const plan = TrainingStore.createPlan(id, topics, { perTopicMax, sourceTypes, throttleMs, maxTasksPerTick, verifyWithDeepseek }, sourceTypes)
    startTrainingOrchestrator()
    return NextResponse.json({ ok: true, planId: plan.id, plan })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'server error' }, { status: 500 })
  }
}
