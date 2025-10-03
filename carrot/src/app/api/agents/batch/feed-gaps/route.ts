import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/agents/batch/feed-gaps
// Body: { agentIds: string[]; perAgent?: { maxTopics?: number; maxPdfsPerTopic?: number } }
// For each agent: Deepseek to propose top topics (gaps), then
// - feed-topic-pdfs per topic (Deepseek-first → scan/save → RAW ingest)
// - retrieve-specific across other sources with autoFeed
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const agentIds: string[] = Array.isArray(body.agentIds) ? body.agentIds : []
    const maxTopics: number = Math.max(1, Math.min(10, body.perAgent?.maxTopics ?? 4))
    const maxPdfsPerTopic: number = Math.max(1, Math.min(5, body.perAgent?.maxPdfsPerTopic ?? 2))
    if (!agentIds.length) return NextResponse.json({ ok: false, error: 'agentIds required' }, { status: 400 })

    const perAgentResults: any[] = []

    for (const agentId of agentIds) {
      const agentSummary: any = { agentId, topics: [], pdfs: [], other: [] }

      // 1) Deepseek topic discovery (gaps)
      try {
        const ds = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/deepseek/chat`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: [
            { role: 'system', content: 'You return only JSON array of short topic strings that would substantially improve the agent\'s knowledge given the provided context. No prose.' },
            { role: 'user', content: `Agent: ${agentId}\nReturn up to ${maxTopics} pivotal topics the agent should learn next.` }
          ]})
        })
        const dj: any = await ds.json().catch(()=>({}))
        const raw = dj?.response || ''
        const s = raw.indexOf('['), e = raw.lastIndexOf(']')
        if (s !== -1 && e !== -1) {
          const arr = JSON.parse(raw.slice(s, e+1)) as any[]
          const topics: string[] = arr.filter(x=> typeof x === 'string').slice(0, maxTopics)
          agentSummary.topics = topics

          // 2) For each topic, run PDFs pipeline
          for (const topic of topics) {
            try {
              const r = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/agents/${agentId}/feed-topic-pdfs`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic, maxPdfs: maxPdfsPerTopic, preferRaw: true, tags: ['pdf', topic] })
              })
              const j = await r.json().catch(()=>({ ok: false }))
              agentSummary.pdfs.push({ topic, ok: !!j?.ok, totals: j?.totals, results: j?.results })
            } catch (e:any) {
              agentSummary.pdfs.push({ topic, ok: false, error: e?.message || 'pdfs failed' })
            }
          }

          // 3) Other sources autoFeed (Wikipedia, books, academic, pubmed, news, github, stackoverflow, web)
          for (const topic of topics) {
            try {
              const r2 = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/agents/${agentId}/retrieve-specific`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  query: topic,
                  sourceTypes: ['wikipedia','books','academic','pubmed','news','github','stackoverflow','web'],
                  maxResults: 20,
                  openAccessOnly: true,
                  autoFeed: true
                })
              })
              const j2 = await r2.json().catch(()=>({ ok: false }))
              agentSummary.other.push({ topic, ok: !!j2?.ok, results: j2?.results?.length || 0 })
            } catch (e:any) {
              agentSummary.other.push({ topic, ok: false, error: e?.message || 'retrieve failed' })
            }
          }
        }
      } catch (e:any) {
        agentSummary.error = e?.message || 'deepseek topic discovery failed'
      }

      perAgentResults.push(agentSummary)
      // small throttle between agents
      await new Promise(r=> setTimeout(r, 100))
    }

    return NextResponse.json({ ok: true, results: perAgentResults })
  } catch (e:any) {
    console.error('[batch/feed-gaps] error', e)
    return NextResponse.json({ ok: false, error: e?.message || 'server error' }, { status: 500 })
  }
}
