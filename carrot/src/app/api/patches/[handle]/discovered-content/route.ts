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
        patchId: patch.id,
        status: 'ready'
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit,
      skip: offset,
      select: {
        id: true,
        title: true,
        sourceUrl: true,
        canonicalUrl: true,
        type: true,
        content: true,
        relevanceScore: true,
        status: true,
        createdAt: true,
        enrichedContent: true,
        mediaAssets: true,
        metadata: true,
        qualityScore: true,
        freshnessScore: true,
        diversityBucket: true
      }
    });
    const t4 = Date.now();
    
    console.log('[Discovered Content] Database query results:', {
      patchId: patch.id,
      handle,
      totalItems: allContent.length
    });

    // Transform the query results
    let discoveredContent = allContent.map(item => ({
      id: item.id,
      title: item.title,
      url: item.sourceUrl,
      canonicalUrl: item.canonicalUrl,
      type: item.type,
      description: item.content,
      relevanceScore: item.relevanceScore,
      status: item.status,
      createdAt: item.createdAt,
      // Rich content data
      enrichedContent: item.enrichedContent,
      mediaAssets: item.mediaAssets,
      metadata: item.metadata,
      qualityScore: item.qualityScore,
      freshnessScore: item.freshnessScore,
      diversityBucket: item.diversityBucket
    }));

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
