import { NextResponse } from 'next/server'
import { ContentRetriever } from '@/lib/ai-agents/contentRetriever'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/agents/[id]/feed-topic-pdfs
// Body: { topic: string; maxPdfs?: number; tags?: string[]; preferRaw?: boolean }
// Fully-automatic pipeline:
// 1) discover relevant PDFs (web search filetype:pdf)
// 2) scan+save to storage (books/save)
// 3) ingest into agent (raw if available, else deepseek)
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: agentId } = await ctx.params
  try {
    const body = await req.json()
    const topic: string = String(body.topic || '').trim()
    const maxPdfs: number = Math.max(1, Math.min(10, body.maxPdfs || 3))
    const tags: string[] = Array.isArray(body.tags) ? body.tags : []
    const preferRaw: boolean = Boolean(body.preferRaw ?? true)
    if (!topic) return NextResponse.json({ ok: false, error: 'topic required' }, { status: 400 })

    // 1) Deepseek-first discovery with scoring and agent-aware context
    const pdfUrls: string[] = []
    try {
      const ds = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/deepseek/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [
          { role: 'system', content: 'You return only JSON. Given a topic and agent context, return an array of objects of the most relevant public PDF links. Schema: [{"url":"https://...pdf","title":"...","score":0.0-1.0}]. Only include reputable sources; avoid spam or paywalled content. No prose.' },
          { role: 'user', content: `Topic: ${topic}\nAgent: ${agentId}\nReturn top ${maxPdfs} PDF links with title and relevance score.` }
        ]})
      })
      const dj: any = await ds.json().catch(()=>({}))
      const raw = dj?.response || ''
      const s = raw.indexOf('['), e = raw.lastIndexOf(']')
      if (s !== -1 && e !== -1) {
        const arr = JSON.parse(raw.slice(s, e+1)) as any[]
        const filtered = arr
          .filter(x => x && typeof x.url === 'string' && x.url.toLowerCase().endsWith('.pdf'))
          .map(x => ({ url: x.url, score: typeof x.score === 'number' ? x.score : 0.5 }))
          .sort((a,b)=> (b.score - a.score))
        for (const it of filtered) {
          pdfUrls.push(it.url)
          if (pdfUrls.length >= maxPdfs) break
        }
      }
    } catch {}

    // Fallback: web search for PDFs
    if (pdfUrls.length < maxPdfs) {
      const need = maxPdfs - pdfUrls.length
      try {
        const query = `${topic} filetype:pdf`
        const webResults = await ContentRetriever.searchWeb(query, 20).catch(()=>[])
        for (const r of webResults) {
          const u = (r.url || '').toLowerCase()
          if (u.endsWith('.pdf') && !pdfUrls.includes(r.url)) pdfUrls.push(r.url)
          if (pdfUrls.length >= maxPdfs) break
        }
      } catch {}
    }

    if (!pdfUrls.length) return NextResponse.json({ ok: false, error: 'no pdfs found' }, { status: 404 })

    const results: any[] = []

    for (const url of pdfUrls) {
      // 2) scan+save
      const saveRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/books/save`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, title: topic })
      })
      const saved: any = await saveRes.json().catch(()=>({ ok: false }))
      if (!saved?.ok) {
        results.push({ url, step: 'save', ok: false, error: saved?.error || 'save failed' })
        continue
      }

      // 3) ingest
      const mode = preferRaw ? 'raw' : 'deepseek'
      const ingestRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/agents/${agentId}/ingest-pdf`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: saved.fileUrl, title: topic, tags: ['pdf', topic, ...tags], mode })
      })
      const ing: any = await ingestRes.json().catch(()=>({ ok: false }))
      results.push({ url, step: 'ingest', ok: !!ing?.ok, mode: ing?.mode, fed: ing?.fed, error: ing?.error })
    }

    const okCount = results.filter(r=> r.ok).length
    return NextResponse.json({ ok: okCount>0, topic, totals: { requested: pdfUrls.length, succeeded: okCount }, results })
  } catch (e:any) {
    console.error('[feed-topic-pdfs] error', e)
    return NextResponse.json({ ok: false, error: e?.message || 'server error' }, { status: 500 })
  }
}
