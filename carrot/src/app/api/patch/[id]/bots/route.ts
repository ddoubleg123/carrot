import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: patchId } = await context.params;

    const botSubscriptions = await prisma.botSubscription.findMany({
      where: { patchId },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            username: true,
            image: true
          }
        }
      }
    });

    // Mock bot data (in real implementation, this would come from a bots table)
    const botSubscriptionsWithBotData = botSubscriptions.map(sub => ({
      ...sub,
      bot: {
        id: sub.botId,
        name: `AI Bot ${sub.botId.slice(-4)}`,
        avatar: null,
        lastIndexed: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString()
      }
    }));

    return NextResponse.json({
      success: true,
      bots: botSubscriptionsWithBotData
    });
  } catch (error) {
    console.error('Error fetching patch bots:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bots' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: patchId } = await context.params;
    const body = await request.json();
    const { botId } = body;

    if (!botId) {
      return NextResponse.json(
        { error: 'botId is required' },
        { status: 400 }
      );
    }

    // Verify patch exists
    const patch = await prisma.patch.findUnique({
      where: { id: patchId }
    });

    if (!patch) {
      return NextResponse.json(
        { error: 'Patch not found' },
        { status: 404 }
      );
    }

    // Check if bot subscription already exists
    const existingSubscription = await prisma.botSubscription.findUnique({
      where: {
        patchId_botId: {
          patchId: patchId,
          botId: botId
        }
      }
    });

    if (existingSubscription) {
      return NextResponse.json(
        { error: 'Bot is already connected to this patch' },
        { status: 409 }
      );
    }

    // Create bot subscription
    const botSubscription = await prisma.botSubscription.create({
      data: {
        patchId: patchId,
        botId: botId,
        ownerUserId: session.user.id
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            username: true,
            image: true
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      subscription: botSubscription
    });
  } catch (error) {
    console.error('Error connecting bot to patch:', error);
    return NextResponse.json(
      { error: 'Failed to connect bot' },
      { status: 500 }
    );
  }
}
