import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { chooseCanonical } from '@/lib/ingest/canonical';
import { deepseekAudit } from '@/lib/audit/deepseek';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Ingestion Gateway
 * Accepts { url?: string, title?: string, type?: 'article'|'video'|'image'|'pdf'|'text', agentId?, patchHint? }
 * Creates a DiscoveredContent row and performs lightweight enrichment inline (mock) for demo.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const url = typeof body?.url === 'string' ? body.url : undefined;
    const title = typeof body?.title === 'string' ? body.title : undefined;
    const type = (['article','video','image','pdf','text'] as const).includes(body?.type) ? body.type : 'article';
    const patchHint = typeof body?.patchHint === 'string' ? body.patchHint : undefined;

    const canonicalUrl = chooseCanonical(url, undefined) || undefined;

    // Optional: locate a patch by handle if provided
    let patchId: string | undefined;
    if (patchHint) {
      const patch = await prisma.patch.findFirst({ where: { handle: patchHint }, select: { id: true } });
      patchId = patch?.id;
    }

    // Create discovered content
    const item = await prisma.discoveredContent.create({
      data: {
        patchId: patchId || (await fallbackFirstPatchId()),
        type,
        title: title || (url ? new URL(url).hostname : 'Untitled'),
        content: '',
        relevanceScore: 5,
        sourceUrl: url,
        // canonicalUrl omitted here to satisfy current Prisma client types
        tags: [],
        status: 'enriching',
      },
    });

    // Minimal enrichment (mock DeepSeek) using URL as text seed
    const audit = await deepseekAudit({ text: `${title || ''} ${url || ''}`.trim() || 'content', kind: type as any });

    await prisma.discoveredContent.update({
      where: { id: item.id },
      data: {
        // Store key enrichment in metadata and content for compatibility
        content: audit.summaryShort,
        metadata: {
          readingTime: audit.readingTimeSec,
          categories: audit.categories,
          tags: audit.tags,
          keyPoints: audit.keyPoints,
          notableQuote: audit.notableQuote,
          canonicalUrl,
        },
        qualityScore: audit.qualityScore,
        status: 'ready',
      },
    });

    return NextResponse.json({ ok: true, id: item.id });
  } catch (err: any) {
    console.error('Ingest error', err);
    return NextResponse.json({ ok: false, error: err?.message || 'ingest failed' }, { status: 500 });
  }
}

async function fallbackFirstPatchId() {
  const any = await prisma.patch.findFirst({ select: { id: true } });
  if (any?.id) return any.id;
  // create a seed patch if none exists
  const created = await prisma.patch.create({
    data: {
      handle: 'general',
      name: 'General',
      description: 'General Patch',
      tags: [],
      createdBy: (await ensureSeedUser()).id,
    },
    select: { id: true },
  });
  return created.id;
}

async function ensureSeedUser() {
  const u = await prisma.user.findFirst({});
  if (u) return u;
  return prisma.user.create({ data: { email: `seed-${Date.now()}@carrot.local`, name: 'Seed User' } });
}
