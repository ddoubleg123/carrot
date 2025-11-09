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
      select: { id: true, createdAt: true }
    });

    if (!patch) {
      return NextResponse.json({ error: 'Patch not found' }, { status: 404 });
    }

    // Check if this is a recently created patch (within last 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const isRecentlyCreated = patch.createdAt > fiveMinutesAgo;

    // Compute basic discovery metrics
    const totalDiscovered = await prisma.discoveredContent.count({
      where: { patchId: patch.id }
    });

    const summarizedCount = await prisma.discoveredContent.count({
      where: {
        patchId: patch.id,
        NOT: { summary: null }
      }
    });

    const latestContent = await prisma.discoveredContent.findMany({
      where: {
        patchId: patch.id
      },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: {
        id: true,
        category: true,
        title: true,
        relevanceScore: true,
        summary: true,
        createdAt: true
      }
    });

    const isDiscoveryActive = isRecentlyCreated && totalDiscovered < 5; // Still discovering if < 5 items

    return NextResponse.json({
      success: true,
      isDiscoveryActive,
      isRecentlyCreated,
      totalDiscovered,
      latestContent,
      discoveryStats: {
        summarized: summarizedCount,
        unsummarized: Math.max(0, totalDiscovered - summarizedCount)
      }
    });

  } catch (error) {
    console.error('Error fetching discovery status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch discovery status' },
      { status: 500 }
    );
  }
}
