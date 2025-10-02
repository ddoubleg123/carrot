import { NextResponse } from 'next/server'
import { FeedService } from '@/lib/ai-agents/feedService'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/agents/[id]/ingest-pdf
// Body: { url: string; title?: string; tags?: string[]; mode?: 'raw'|'deepseek'; chunkSize?: number; maxPages?: number }
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: agentId } = await ctx.params
  try {
    const body = await req.json()
    const url: string = body.url
    const title: string | undefined = body.title
    const tags: string[] = Array.isArray(body.tags) ? body.tags : []
    const mode: 'raw'|'deepseek' = (body.mode === 'raw' || body.mode === 'deepseek') ? body.mode : 'deepseek'
    const chunkSize: number = Math.max(800, Math.min(2400, body.chunkSize || 1400))
    const maxPages: number | undefined = typeof body.maxPages === 'number' ? body.maxPages : undefined

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ ok: false, error: 'url required' }, { status: 400 })
    }

    // Attempt HEAD to validate and get content type/length
    let contentType = ''
    try {
      const head = await fetch(url, { method: 'HEAD' })
      contentType = head.headers.get('content-type') || ''
    } catch {}

    // Helper: feed a chunk
    const feedChunk = async (text: string, meta: { part?: number; total?: number }) => {
      const sourceTitle = title || `PDF Ingest: ${url.split('/').pop() || 'document'}`
      const feedItem = {
        content: text,
        // Use a valid FeedItem sourceType; annotate as URL with 'pdf' tag
        sourceType: 'url' as const,
        sourceUrl: url,
        sourceTitle,
        tags: ['pdf', ...(tags||[])],
      }
      return FeedService.feedAgent(agentId, feedItem, 'pdf-ingest')
    }

    // Mode A: raw parse (best quality when pdf-parse installed)
    if (mode === 'raw') {
      try {
        // Lazy import to avoid bundling when unavailable
        // Optional dependency: suppress TS resolution error when not installed
        // @ts-ignore - pdf-parse may not be present in every deployment
        const pdfParse = (await import('pdf-parse')).default as any
        const res = await fetch(url)
        if (!res.ok) throw new Error(`Failed to download PDF: ${res.status}`)
        const buf = Buffer.from(await res.arrayBuffer())
        const parsed = await pdfParse(buf, maxPages ? { max: maxPages } : undefined)
        const text: string = parsed?.text || ''
        if (!text.trim()) throw new Error('Parsed PDF text is empty')

        // Chunk
        const { chunkText } = await import('@/lib/text/chunker')
        const chunks = chunkText(text, chunkSize)
        let fed = 0
        for (let i = 0; i < chunks.length; i++) {
          const part = chunks[i]
          await feedChunk(part, { part: i+1, total: chunks.length })
          fed++
          // simple throttle
          await new Promise(r=> setTimeout(r, 50))
        }
        return NextResponse.json({ ok: true, mode: 'raw', chunks: chunks.length, fed })
      } catch (e:any) {
        // Fall back to deepseek mode if raw fails or pdf-parse missing
        console.warn('[ingest-pdf] raw mode failed, falling back to deepseek:', e?.message || e)
      }
    }

    // Mode B: Deepseek-assisted ingestion (no server-side parsing required)
    try {
      const system = 'You are an expert research assistant. Given a public PDF/book URL, extract an outline, key sections, and concise factual summaries useful for long-term study. Keep each summary under 1200 characters. Do not fabricate.'
      const prompt = `Read this document: ${url}\n\nReturn JSON only with: {\n  outline: string[],\n  highlights: Array<{ section: string; summary: string }>,\n  citations?: Array<{ text: string; page?: number }>\n}`
      // Call our Deepseek chat route
      const r = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/deepseek/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt }
        ]})
      })
      const j: any = await r.json().catch(()=>({}))
      const raw = j?.response || ''
      const jsonStart = raw.indexOf('{')
      const jsonEnd = raw.lastIndexOf('}')
      let structured: any = null
      if (jsonStart !== -1 && jsonEnd !== -1) {
        try { structured = JSON.parse(raw.slice(jsonStart, jsonEnd+1)) } catch {}
      }

      const pieces: string[] = []
      if (structured?.outline && Array.isArray(structured.outline)) {
        pieces.push(`Outline:\n- ${structured.outline.join('\n- ')}`)
      }
      if (structured?.highlights && Array.isArray(structured.highlights)) {
        for (const h of structured.highlights) {
          pieces.push(`Section: ${h.section || 'Unknown'}\n${h.summary || ''}`)
        }
      }
      if (!pieces.length && raw) {
        pieces.push(raw.slice(0, 4000))
      }

      // Feed each piece
      let fed = 0
      for (const piece of pieces) {
        await feedChunk(piece, {})
        fed++
        await new Promise(r=> setTimeout(r, 50))
      }
      return NextResponse.json({ ok: true, mode: 'deepseek', fed, pieces: pieces.length })
    } catch (e:any) {
      console.error('[ingest-pdf] deepseek mode failed:', e)
      return NextResponse.json({ ok: false, error: e?.message || 'Ingest failed' }, { status: 500 })
    }
  } catch (e:any) {
    return NextResponse.json({ ok: false, error: e?.message || 'server error' }, { status: 500 })
  }
}
