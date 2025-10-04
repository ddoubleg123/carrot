import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: NextRequest,
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

        // Simulate content enrichment (replace with actual enrichment logic)
        const enrichedData = await enrichContent(item);

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

// Mock content enrichment function
async function enrichContent(item: any) {
  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

  // Generate mock enriched content
  const mockContent = {
    summary150: `This ${item.type} provides valuable insights about ${item.title.toLowerCase()}. It covers key aspects and offers practical information for understanding the topic.`,
    keyPoints: [
      'Key insight 1',
      'Important detail 2', 
      'Practical application 3'
    ],
    notableQuote: item.type === 'video' 
      ? '"This is a notable quote from the video content that provides valuable insight."'
      : undefined,
    fullText: item.type === 'article' ? 'Full article content would be extracted here...' : undefined,
    transcript: item.type === 'video' ? 'Video transcript would be extracted here...' : undefined
  };

  const mockMedia = {
    hero: generateFallbackImage(item.title, item.type),
    gallery: [],
    videoThumb: item.type === 'video' ? generateFallbackImage(item.title, item.type) : undefined,
    pdfPreview: item.type === 'pdf' ? generateFallbackImage(item.title, item.type) : undefined
  };

  const mockMetadata = {
    author: 'Content Author',
    publishDate: new Date().toISOString(),
    source: extractDomain(item.sourceUrl || ''),
    readingTime: Math.max(1, Math.floor(Math.random() * 10)),
    tags: ['tag1', 'tag2', 'tag3'],
    entities: ['Entity 1', 'Entity 2'],
    citation: {
      title: item.title,
      url: item.sourceUrl,
      type: item.type
    }
  };

  return {
    content: mockContent,
    media: mockMedia,
    metadata: mockMetadata,
    qualityScore: 0.7 + Math.random() * 0.3, // 0.7-1.0
    freshnessScore: 0.8 + Math.random() * 0.2, // 0.8-1.0
    diversityBucket: `bucket_${Math.floor(Math.random() * 5)}`
  };
}

function generateFallbackImage(title: string, type: string) {
  const colors = {
    article: '0A5AFF',
    video: 'FF6A00', 
    pdf: '8B5CF6',
    post: '10B981'
  };
  
  const color = colors[type as keyof typeof colors] || '60646C';
  const encodedTitle = encodeURIComponent(title.substring(0, 50));
  
  return `https://ui-avatars.com/api/?name=${encodedTitle}&background=${color}&color=fff&size=800&format=png&bold=true`;
}

function extractDomain(url: string) {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return 'Unknown Source';
  }
}
