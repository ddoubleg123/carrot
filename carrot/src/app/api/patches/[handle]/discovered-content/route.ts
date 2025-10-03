import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ handle: string }> }
) {
  try {
    const { handle } = await params;

    // Find the patch by handle
    const patch = await prisma.patch.findUnique({
      where: { handle },
      select: { id: true }
    });

    if (!patch) {
      return NextResponse.json({ error: 'Patch not found' }, { status: 404 });
    }

    // Fetch discovered content from Source table (where discovery saves items)
    const sources = await prisma.source.findMany({
      where: {
        patchId: patch.id
      },
      orderBy: [
        { createdAt: 'desc' }
      ]
    });

    // Transform sources to discovered content format
    const discoveredContent = sources.map(source => ({
      id: source.id,
      title: source.title,
      url: source.url,
      type: (source.citeMeta as any)?.type || 'article',
      description: (source.citeMeta as any)?.description || '',
      relevanceScore: (source.citeMeta as any)?.relevanceScore || 0.8,
      status: (source.citeMeta as any)?.status || 'pending_audit',
      createdAt: source.createdAt
    }));

    return NextResponse.json({
      success: true,
      items: discoveredContent,
      isActive: discoveredContent.length > 0,
      totalItems: discoveredContent.length
    });

  } catch (error) {
    console.error('Error fetching discovered content:', error);
    return NextResponse.json(
      { error: 'Failed to fetch discovered content' },
      { status: 500 }
    );
  }
}
