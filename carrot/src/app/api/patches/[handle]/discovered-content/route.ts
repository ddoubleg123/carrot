import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ handle: string }> }
) {
  const { searchParams } = new URL(req.url)
  const limit = parseInt(searchParams.get('limit') || '6')
  const offset = parseInt(searchParams.get('offset') || '0')
  try {
    console.log('[Discovered Content] ===== API CALLED =====');
    const t0 = Date.now();
    const { handle } = await params;
    console.log('[Discovered Content] Fetching content for patch handle:', handle);

    // Find the patch by handle
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

    // Fetch discovered content from both Source and DiscoveredContent tables
    const [sources, discoveredContentData] = await Promise.all([
      prisma.source.findMany({
        where: { patchId: patch.id },
        orderBy: [{ createdAt: 'desc' }],
        skip: offset,
        take: limit
      }),
      prisma.discoveredContent.findMany({
        where: { patchId: patch.id },
        orderBy: [{ createdAt: 'desc' }],
        skip: offset,
        take: limit
      })
    ]);
    const t3 = Date.now();
    
    console.log('[Discovered Content] Database query results:', {
      patchId: patch.id,
      handle,
      sourcesCount: sources.length,
      discoveredContentCount: discoveredContentData.length,
      sources: sources.map(s => ({ id: s.id, title: s.title, url: s.url })),
      discoveredContent: discoveredContentData.map(d => ({ id: d.id, title: d.title, sourceUrl: d.sourceUrl }))
    });

    console.log('[Discovered Content] Raw sources data:', sources);
    console.log('[Discovered Content] Raw discoveredContent data:', discoveredContentData);

    // Transform sources to discovered content format
    const sourceItems = sources.map(source => ({
      id: source.id,
      title: source.title,
      url: source.url,
      type: (source.citeMeta as any)?.type || 'article',
      description: (source.citeMeta as any)?.description || '',
      relevanceScore: (source.citeMeta as any)?.relevanceScore || 0.8,
      status: (source.citeMeta as any)?.status || 'pending_audit',
      createdAt: source.createdAt,
      // Legacy format - no enriched content
      enrichedContent: undefined,
      mediaAssets: (source.citeMeta as any)?.mediaAssets || undefined, // Check for existing mediaAssets
      metadata: undefined,
      qualityScore: undefined
    }));

    // Transform discovered content to rich format
    const enrichedItems = discoveredContentData.map(item => ({
      id: item.id,
      title: item.title,
      url: item.sourceUrl,
      canonicalUrl: item.canonicalUrl,
      type: item.type,
      description: item.content, // Legacy content field
      relevanceScore: item.relevanceScore,
      status: item.status,
      createdAt: item.createdAt,
      // Rich content data
      enrichedContent: item.enrichedContent as any,
      mediaAssets: item.mediaAssets as any,
      metadata: item.metadata as any,
      qualityScore: item.qualityScore,
      freshnessScore: item.freshnessScore,
      diversityBucket: item.diversityBucket
    }));

    // Combine and deduplicate - prioritize discoveredContent over sources
    const allItems = [...enrichedItems, ...sourceItems]; // Put discoveredContent first
    const uniqueItems = allItems.reduce((acc, item) => {
      const key = item.url || item.id;
      if (!acc.has(key)) {
        acc.set(key, item);
      } else {
        // Prefer items with metadata (URL data) over legacy items
        const existing = acc.get(key);
        if (item.metadata && !existing?.metadata) {
          acc.set(key, item);
        }
      }
      return acc;
    }, new Map());

    let discoveredContent = Array.from(uniqueItems.values());

    // Server-side link verification gate: only include items whose source verifies (<400)
    try {
      const proto = (req.headers as any).get?.('x-forwarded-proto') || 'https'
      const host = (req.headers as any).get?.('host')
      const baseUrl = host ? `${proto}://${host}` : ''

      const verifyOne = async (item: any) => {
        const url = item.canonicalUrl || item.url
        if (!url) return { ok: false, item }

        // If item already has lastVerifiedStatus in metadata, respect it fast-path
        const lastVerified = (item.metadata as any)?.lastVerifiedStatus
        if (typeof lastVerified === 'number') {
          return { ok: lastVerified < 400, item }
        }

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
    // Report simple timing: param resolution, patch lookup, sources fetch
    const timings = [
      `prep;desc=param_resolve;dur=${t1 - t0}`,
      `patch;desc=patch_lookup;dur=${t2 - t1}`,
      `sources;desc=sources_fetch;dur=${t3 - t2}`
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
