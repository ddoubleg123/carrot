import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
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

    // Fetch discovered content for this patch
    const discoveredContent = await prisma.discoveredContent.findMany({
      where: {
        patchId: patch.id,
        status: { in: ['pending', 'approved', 'audited'] } // Exclude rejected content
      },
      orderBy: [
        { relevanceScore: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    return NextResponse.json({
      success: true,
      discoveredContent,
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
