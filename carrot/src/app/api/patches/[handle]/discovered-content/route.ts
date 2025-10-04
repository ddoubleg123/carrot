import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ handle: string }> }
) {
  try {
    const t0 = Date.now();
    const { handle } = await params;

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
    const [sources, discoveredContent] = await Promise.all([
      prisma.source.findMany({
        where: { patchId: patch.id },
        orderBy: [{ createdAt: 'desc' }]
      }),
      prisma.discoveredContent.findMany({
        where: { patchId: patch.id },
        orderBy: [{ createdAt: 'desc' }]
      })
    ]);
    const t3 = Date.now();

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
      mediaAssets: undefined,
      metadata: undefined,
      qualityScore: undefined
    }));

    // Transform discovered content to rich format
    const enrichedItems = discoveredContent.map(item => ({
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

    // Combine and deduplicate by URL
    const allItems = [...sourceItems, ...enrichedItems];
    const uniqueItems = allItems.reduce((acc, item) => {
      const key = item.url || item.id;
      if (!acc.has(key)) {
        acc.set(key, item);
      } else {
        // Prefer enriched content over legacy
        const existing = acc.get(key);
        if (item.enrichedContent && !existing?.enrichedContent) {
          acc.set(key, item);
        }
      }
      return acc;
    }, new Map());

    const discoveredContent = Array.from(uniqueItems.values());

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
    return NextResponse.json(
      { error: 'Failed to fetch discovered content' },
      { status: 500 }
    );
  }
}
