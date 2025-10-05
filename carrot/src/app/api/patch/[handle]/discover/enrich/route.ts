import { NextResponse } from 'next/server';
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
        status: 'queued'
      },
      take: 5, // Process 5 items at a time
      orderBy: { createdAt: 'asc' }
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
        // Update status to fetching
        await prisma.discoveredContent.update({
          where: { id: item.id },
          data: { status: 'fetching' }
        });

        // Process content with real enrichment
        const enrichedData = await ContentProcessor.processItem(
          item.sourceUrl || '',
          item.type as any,
          item.title
        );

        // Update with enriched data
        await prisma.discoveredContent.update({
          where: { id: item.id },
          data: {
            status: 'ready',
            enrichedContent: enrichedData.content,
            mediaAssets: enrichedData.media,
            metadata: enrichedData.metadata,
            qualityScore: enrichedData.qualityScore,
            freshnessScore: enrichedData.freshnessScore,
            diversityBucket: enrichedData.diversityBucket
          }
        });

        results.push({ id: item.id, status: 'success' });
      } catch (error) {
        console.error(`Failed to enrich item ${item.id}:`, error);
        
        // Mark as failed
        await prisma.discoveredContent.update({
          where: { id: item.id },
          data: { 
            status: 'failed',
            auditNotes: `Enrichment failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        });

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

