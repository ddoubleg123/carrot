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

    // Get discovery status
    const discoveryStats = await prisma.discoveredContent.groupBy({
      by: ['status'],
      where: {
        patchId: patch.id
      },
      _count: {
        status: true
      }
    });

    // Get latest discovered content (last 3 items)
    const latestContent = await prisma.discoveredContent.findMany({
      where: {
        patchId: patch.id,
        status: { in: ['pending', 'approved', 'audited'] }
      },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: {
        id: true,
        type: true,
        title: true,
        relevanceScore: true,
        status: true,
        createdAt: true
      }
    });

    // Calculate discovery progress
    const totalDiscovered = discoveryStats.reduce((sum, stat) => sum + stat._count.status, 0);
    const isDiscoveryActive = isRecentlyCreated && totalDiscovered < 5; // Still discovering if < 5 items

    return NextResponse.json({
      success: true,
      isDiscoveryActive,
      isRecentlyCreated,
      totalDiscovered,
      latestContent,
      discoveryStats: discoveryStats.reduce((acc, stat) => {
        acc[stat.status] = stat._count.status;
        return acc;
      }, {} as Record<string, number>)
    });

  } catch (error) {
    console.error('Error fetching discovery status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch discovery status' },
      { status: 500 }
    );
  }
}
