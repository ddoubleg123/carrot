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
    // Enforce RAW ingestion only per product requirement (no LLM summaries)
    const mode: 'raw' = 'raw'
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

    // RAW parse (requires a PDF parser available on the server)
    if (mode === 'raw') {
      try {
        // Lazy import to avoid bundling when unavailable
        // Optional dependency: suppress TS resolution error when not installed
        // PDF parsing is temporarily disabled due to build issues
        throw new Error('PDF parsing is temporarily unavailable due to build configuration issues');
      } catch (e:any) {
        console.error('[ingest-pdf] RAW mode failed:', e)
        return NextResponse.json({ ok: false, error: 'PDF parser not available on server for RAW ingestion' }, { status: 501 })
      }
    }
    // Should never reach here; RAW returns above. Guard:
    return NextResponse.json({ ok: false, error: 'No ingestion performed' }, { status: 500 })
  } catch (e:any) {
    return NextResponse.json({ ok: false, error: e?.message || 'server error' }, { status: 500 })
  }
}
