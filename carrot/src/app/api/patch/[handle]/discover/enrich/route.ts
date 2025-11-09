import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { ContentProcessor } from '@/lib/content-enrichment/contentProcessor';

export async function POST(
  request: Request,
  context: { params: Promise<{ handle: string }> }
) {
  try {
    const { handle } = await context.params;
    
    if (!handle) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Patch handle is required' 
      }, { status: 400 });
    }

    // Get queued items for this patch
    const queuedItems = await prisma.discoveredContent.findMany({
      where: {
        patch: { handle },
        OR: [
          { summary: { equals: null } },
          { summary: '' },
          { hero: { equals: Prisma.JsonNull } },
          { hero: { path: ['url'], equals: Prisma.JsonNull } }
        ]
      },
      take: 5,
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        title: true,
        sourceUrl: true,
        category: true,
        summary: true,
        metadata: true,
        hero: true
      }
    });

    if (queuedItems.length === 0) {
      return NextResponse.json({ 
        ok: true, 
        message: 'No items to process',
        processed: 0
      });
    }

    const results = [];

    for (const item of queuedItems) {
      try {
        // Process content with real enrichment
        const enrichedData = await ContentProcessor.processItem(
          item.sourceUrl || '',
          (item.category as any) || 'article',
          item.title
        );

        const existingMetadata = (item.metadata as any) || {};
        const updatedMetadata: Prisma.JsonObject = {
          ...existingMetadata,
          summary150: enrichedData.content.summary150,
          keyPoints: enrichedData.content.keyPoints,
          notableQuote: enrichedData.content.notableQuote,
          enrichment: {
            processedAt: new Date().toISOString(),
            readingTime: enrichedData.metadata.readingTime,
            tags: enrichedData.metadata.tags,
            entities: enrichedData.metadata.entities,
            source: enrichedData.metadata.source
          }
        } as Prisma.JsonObject;

        const heroPayload = enrichedData.media.hero
          ? {
              hero: {
                url: enrichedData.media.hero,
                gallery: enrichedData.media.gallery,
                videoThumb: enrichedData.media.videoThumb,
                pdfPreview: enrichedData.media.pdfPreview,
                enrichedAt: new Date().toISOString(),
                origin: 'patch-discover-enrich'
              } as Prisma.JsonObject
            }
          : {};

        const heroValue = heroPayload.hero
          ? (heroPayload.hero as Prisma.InputJsonValue)
          : ((item.hero as Prisma.InputJsonValue) ?? undefined);

        const factsPayload = enrichedData.content.keyPoints.map(point => ({
          text: point
        }));
        const factsJson = factsPayload as unknown as Prisma.InputJsonValue;
 
        // Update with enriched data
        await prisma.discoveredContent.update({
          where: { id: item.id },
          data: {
            summary: enrichedData.content.summary150,
            facts: factsJson,
            metadata: updatedMetadata,
            qualityScore: enrichedData.qualityScore,
            hero: heroValue
          }
        });

        results.push({ id: item.id, status: 'success' });
      } catch (error) {
        console.error(`Failed to enrich item ${item.id}:`, error);
        
        results.push({ id: item.id, status: 'failed', error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    return NextResponse.json({
      ok: true,
      message: `Processed ${results.length} items`,
      processed: results.length,
      results
    });

  } catch (error) {
    console.error('Error in enrichment endpoint:', error);
    return NextResponse.json({ 
      ok: false, 
      error: 'Failed to process enrichment' 
    }, { status: 500 });
  }
}

