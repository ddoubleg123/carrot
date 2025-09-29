import { NextResponse } from 'next/server'
import { TrainingStore } from '@/lib/ai-agents/trainingStore'
import { FeedService } from '@/lib/ai-agents/feedService'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/agents/[id]/training-plan/[planId]/audit
 * Body: { limit?: number }
 * Returns Deepseek validation of recently fed memories related to this plan's topics.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string; planId: string }> }) {
  try {
    const { id, planId } = await params
    const body = await req.json().catch(()=>({})) as any
    const limit = Math.max(1, Math.min(40, parseInt(String(body?.limit ?? '20'), 10) || 20))

    const plan = TrainingStore.getPlan(planId)
    if (!plan || plan.agentId !== id) {
      return NextResponse.json({ ok: false, error: 'plan not found' }, { status: 404 })
    }
    const topics = plan.topics || []

    const memories = await FeedService.getRecentMemories(id, 200)
    // Filter memories that look related to this plan's topics
    const topicSet = new Set(topics.map(t=> t.toLowerCase()))
    const candidates = [] as Array<{ id: string; title: string; url?: string; snippet: string; topic: string }>
    for (const m of memories) {
      const title = m.sourceTitle || 'Untitled'
      const url = m.sourceUrl
      const text = m.content || ''
      const tags: string[] = (m as any).tags || []
      // Pick a topic match from tags or simple text match
      let matchedTopic = ''
      for (const t of topicSet) {
        if (tags.some(x=> String(x).toLowerCase() === t) || (title+ ' ' + text).toLowerCase().includes(t)) {
          matchedTopic = t; break
        }
      }
      if (!matchedTopic) continue
      candidates.push({ id: m.id, title, url: url || undefined, snippet: text.slice(0, 600), topic: matchedTopic })
      if (candidates.length >= limit) break
    }

    // If nothing matched, return early
    if (!candidates.length) {
      return NextResponse.json({ ok: true, planId, count: 0, approved: [], flagged: [], raw: [] })
    }

    // Ask Deepseek to audit
    const prompt = `You are auditing sources already fed to an agent for a training plan.\n`+
      `For each candidate, decide if it directly and authoritatively supports learning the given topic.\n`+
      `Return STRICT JSON array; each element: {\n`+
      `  \"id\": string, // memory id,\n`+
      `  \"ok\": boolean, // true if acceptable,\n`+
      `  \"reason\": string, // short reason,\n`+
      `  \"quality\": number // 0..1 subjective quality\n`+
      `}`

    const res = await fetch('/api/deepseek/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [
        { role: 'system', content: 'You are a rigorous research auditor who validates sources for learning.' },
        { role: 'user', content: prompt + "\n\nCandidates:" + JSON.stringify(candidates) }
      ]})
    })

    const data = await res.json().catch(()=>({})) as any
    const text = (data && (data.response || data.text || data.content)) || ''
    const s = text.indexOf('['); const e = text.lastIndexOf(']')
    let parsed: Array<{ id: string; ok: boolean; reason?: string; quality?: number }> = []
    if (s !== -1 && e !== -1 && e > s) {
      try { parsed = JSON.parse(text.slice(s, e+1)) } catch {}
    }

    const byId = new Map(parsed.filter(x=> x && typeof x.id==='string').map(x=> [x.id, x]))
    const approved: any[] = []
    const flagged: any[] = []
    for (const c of candidates) {
      const j = byId.get(c.id)
      const item = { ...c, ok: !!j?.ok, reason: j?.reason || '', quality: typeof j?.quality==='number'? j?.quality : undefined }
      if (item.ok) approved.push(item); else flagged.push(item)
    }

    return NextResponse.json({ ok: true, planId, count: candidates.length, approved, flagged, raw: parsed })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'server error' }, { status: 500 })
  }
}
