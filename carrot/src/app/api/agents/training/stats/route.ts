import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/agents/training/stats
export async function GET() {
  const prisma = new PrismaClient() as any
  try {
    // Load agents
    const agents = await prisma.agent.findMany({ select: { id: true, name: true } }).catch(() => [])

    // Load all plans (id -> agentId)
    const plans = await prisma.trainingPlan.findMany({ select: { id: true, agentId: true } }).catch(() => [])
    const plansByAgent: Record<string, string[]> = {}
    for (const p of plans) {
      (plansByAgent[p.agentId] ||= []).push(p.id)
    }

    // Load discovery entries for all plans in one go
    const planIds = plans.map((p: any) => p.id)
    const discoveries = planIds.length
      ? await prisma.discoveryEntry.findMany({ where: { planId: { in: planIds } } }).catch(() => [])
      : []

    // Group discoveries by agent -> topic
    const perAgent: Record<string, {
      agentId: string
      agentName?: string
      skills: string[]
      perSkill: Record<string, { retrieved: number; filtered: number; fed: number; failed: number }>
    }> = {}

    const planAgentMap = new Map<string, string>(plans.map((p: any) => [p.id, p.agentId]))
    for (const d of discoveries as any[]) {
      const agentId = planAgentMap.get(d.planId)
      if (!agentId) continue
      const topic = d.topic || 'unknown'
      const rec = (perAgent[agentId] ||= {
        agentId,
        agentName: agents.find((a: any) => a.id === agentId)?.name,
        skills: [],
        perSkill: {},
      })
      if (!rec.perSkill[topic]) rec.perSkill[topic] = { retrieved: 0, filtered: 0, fed: 0, failed: 0 }
      if (!rec.skills.includes(topic)) rec.skills.push(topic)
      const s = String(d.status || 'retrieved') as keyof typeof rec.perSkill[typeof topic]
      if (s in rec.perSkill[topic]) {
        ;(rec.perSkill[topic] as any)[s]++
      } else {
        rec.perSkill[topic].retrieved++
      }
    }

    // Memory counts per agent via groupBy
    let memoryCounts: Record<string, number> = {}
    try {
      const groups = await prisma.agentMemory.groupBy({ by: ['agentId'], _count: { _all: true } })
      for (const g of groups) memoryCounts[g.agentId] = g._count._all
    } catch {}

    const result = {
      ok: true,
      totals: {
        agents: agents.length,
        plans: plans.length,
        discoveries: (discoveries as any[]).length,
      },
      byAgent: Object.entries(perAgent).map(([agentId, rec]) => ({
        agentId,
        agentName: rec.agentName || agentId,
        skills: rec.skills.sort((a, b) => a.localeCompare(b)),
        perSkill: rec.perSkill,
        totalSkills: rec.skills.length,
        totalMemories: memoryCounts[agentId] || 0,
        totalFed: Object.values(rec.perSkill).reduce((n, v) => n + (v.fed || 0), 0),
      })),
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[Training Stats API] Error:', error)
    return NextResponse.json({ ok: false, error: error?.message || 'Failed to build stats' }, { status: 500 })
  }
}
