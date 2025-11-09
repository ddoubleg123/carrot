import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { DiscoveryCardPayload, DiscoveryContested, DiscoveryFact, DiscoveryHero, DiscoveryQuote } from '@/types/discovery-card'

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ handle: string }> }
) {
  const { searchParams } = new URL(req.url)
  const limit = parseInt(searchParams.get('limit') || '50')
  const offset = parseInt(searchParams.get('offset') || '0')
  try {
    console.log('[Discovered Content] ===== API CALLED =====');
    const t0 = Date.now();
    const { handle } = await params;
    console.log('[Discovered Content] Fetching content for patch handle:', handle);

    // Find the patch by handle with caching
    const t1 = Date.now();
    const patch = await prisma.patch.findUnique({
      where: { handle },
      select: { id: true }
    });
    const t2 = Date.now();

    if (!patch) {
      const res = NextResponse.json({ error: 'Patch not found' }, { status: 404 });
      try { res.headers.set('Server-Timing', `prep;dur=${t1 - t0}`); } catch {}
      return res;
    }

    // Query only DiscoveredContent table (Source table doesn't exist)
    const t3 = Date.now();
    const allContent = await prisma.discoveredContent.findMany({
      where: {
        patchId: patch.id
      },
      orderBy: [
        { relevanceScore: 'desc' }, // Most relevant first
        { createdAt: 'desc' }        // Then by newest
      ],
      take: limit,
      skip: offset,
      select: {
        id: true,
        title: true,
        sourceUrl: true,
        canonicalUrl: true,
        category: true,
        summary: true,
        relevanceScore: true,
        createdAt: true,
        whyItMatters: true,
        facts: true,
        quotes: true,
        provenance: true,
        hero: true,
        metadata: true,
        qualityScore: true
      }
    });
    const t4 = Date.now();
    
    console.log('[Discovered Content] Database query results:', {
      patchId: patch.id,
      handle,
      totalItems: allContent.length
    });

    let discoveredContent: DiscoveryCardPayload[] = allContent.map((item) => {
      let domain = 'unknown'
      const primaryUrl = item.canonicalUrl || item.sourceUrl || ''
      try {
        if (primaryUrl) {
          domain = new URL(primaryUrl).hostname.replace(/^www\./, '')
        }
      } catch {}

      const parseJson = <T,>(value: any, fallback: T): T => {
        if (!value) return fallback
        if (typeof value === 'string') {
          try {
            return JSON.parse(value)
          } catch {
            return fallback
          }
        }
        return value as T
      }

      const factsRaw = parseJson<DiscoveryFact[]>(item.facts, [])
      const quotesRaw = parseJson<DiscoveryQuote[]>(item.quotes, [])
      const provenanceRaw = parseJson<string[]>(item.provenance, [])
      const heroRaw = parseJson<DiscoveryHero | null>(item.hero, null)
      const metadataRaw = parseJson<Record<string, any>>(item.metadata, {})

      const facts: DiscoveryFact[] = factsRaw.map((fact, index) => {
        if (typeof fact === 'string') {
          return {
            label: `Fact ${index + 1}`,
            value: fact,
            citation: primaryUrl
          }
        }

        if (fact && typeof fact === 'object') {
          const textValue = (fact as any).value || (fact as any).text || ''
          return {
            label: (fact as any).label || `Fact ${index + 1}`,
            value: textValue,
            citation: (fact as any).citation || primaryUrl
          }
        }

        return {
          label: `Fact ${index + 1}`,
          value: '',
          citation: primaryUrl
        }
      }).filter(fact => fact.value)

      const quotes: DiscoveryQuote[] = quotesRaw.slice(0, 3).map((quote) => ({
        text: quote?.text || '',
        speaker: quote?.speaker,
        citation: quote?.citation || primaryUrl
      })).filter(quote => quote.text)

      const provenance = provenanceRaw.length ? provenanceRaw : [primaryUrl]
      const contestedValue = metadataRaw?.contested as DiscoveryContested | undefined
      const contestedClaim = metadataRaw?.contestedClaim || contestedValue?.claim
      const viewSourceStatus = typeof metadataRaw?.viewSourceStatus === 'number' ? metadataRaw.viewSourceStatus : undefined

      return {
        id: item.id,
        title: item.title,
        url: primaryUrl,
        canonicalUrl: primaryUrl,
        domain,
        sourceType: metadataRaw?.sourceType || item.category || 'article',
        credibilityTier: metadataRaw?.credibilityTier,
        angle: metadataRaw?.angle,
        noveltySignals: metadataRaw?.noveltySignals,
        expectedInsights: metadataRaw?.expectedInsights,
        reason: metadataRaw?.reason,
        whyItMatters: (typeof item.whyItMatters === 'string' && item.whyItMatters.trim())
          ? item.whyItMatters.trim()
          : (metadataRaw?.summary150 || item.summary || ''),
        facts,
        quotes,
        provenance,
        contested: contestedValue && contestedValue.note ? contestedValue : null,
        contestedClaim: contestedClaim || undefined,
        hero: heroRaw,
        relevanceScore: Number(item.relevanceScore ?? 0),
        qualityScore: Number(item.qualityScore ?? 0),
        viewSourceOk: viewSourceStatus ? viewSourceStatus < 400 : metadataRaw?.viewSourceOk !== false,
        savedAt: item.createdAt?.toISOString() || new Date().toISOString()
      }
    })

    // Server-side link verification gate: only include items whose source verifies (<400)
    try {
      const proto = (req.headers as any).get?.('x-forwarded-proto') || 'https'
      const host = (req.headers as any).get?.('host')
      const baseUrl = host ? `${proto}://${host}` : ''

      const verifyOne = async (item: any) => {
        const url = item.canonicalUrl || item.url
        if (!url) return { ok: false, item }

        try {
          const verifyRes = await fetch(`${baseUrl}/api/internal/links/verify?url=${encodeURIComponent(url)}`, {
            method: 'GET',
            // keep tight server timeout
            headers: { 'Accept': 'application/json' },
          })
          if (!verifyRes.ok) return { ok: false, item }
          const data = await verifyRes.json()
          return { ok: !!data?.ok, item, status: data?.status }
        } catch {
          return { ok: false, item }
        }
      }

      const verified = await Promise.all(discoveredContent.map(verifyOne))
      discoveredContent = verified.filter(v => v.ok).map(v => v.item)
    } catch (e) {
      // If verification fails for any reason, fall back to original list (do not break endpoint)
      try { console.warn('[Discovered Content] verification gate failed:', (e as any)?.message) } catch {}
    }

    const res = NextResponse.json({
      success: true,
      items: discoveredContent,
      isActive: discoveredContent.length > 0,
      totalItems: discoveredContent.length
    });
    // Report optimized timing: param resolution, patch lookup, unified query
    const timings = [
      `prep;desc=param_resolve;dur=${t1 - t0}`,
      `patch;desc=patch_lookup;dur=${t2 - t1}`,
      `query;desc=unified_fetch;dur=${t4 - t3}`
    ].join(', ');
    try { res.headers.set('Server-Timing', timings); } catch {}
    return res;

  } catch (error) {
    console.error('Error fetching discovered content:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      handle: await params.then(p => p.handle).catch(() => 'unknown')
    });
    return NextResponse.json(
      { 
        error: 'Failed to fetch discovered content',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
