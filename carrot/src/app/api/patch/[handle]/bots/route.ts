import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ handle: string }> }
) {
  try {
    const { handle: patchHandle } = await params;
    
    // Find the patch by handle
    const patch = await prisma.patch.findUnique({
      where: { handle: patchHandle }
    });
    
    if (!patch) {
      return NextResponse.json({ error: 'Patch not found' }, { status: 404 });
    }
    
    const patchId = patch.id;

    // Get bot subscriptions for this patch
    const botSubscriptions = await prisma.botSubscription.findMany({
      where: { patchId },
      include: {
        owner: {
          select: {
            id: true,
            username: true,
            image: true,
            name: true
          }
        }
      }
    });

    // Add mock bot data for each subscription
    const botSubscriptionsWithBotData = botSubscriptions.map(sub => ({
      ...sub,
      bot: {
        id: sub.botId,
        name: `AI Bot ${sub.botId.slice(-4)}`,
        avatar: undefined,
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
      { error: 'Failed to fetch patch bots' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ handle: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { handle: patchHandle } = await params;
    
    // Find the patch by handle
    const patch = await prisma.patch.findUnique({
      where: { handle: patchHandle }
    });
    
    if (!patch) {
      return NextResponse.json({ error: 'Patch not found' }, { status: 404 });
    }
    
    const patchId = patch.id;

    const body = await req.json();
    const { botId } = body;

    if (!botId) {
      return NextResponse.json({ error: 'Bot ID is required' }, { status: 400 });
    }

    // Check if bot is already connected to this patch
    const existingSubscription = await prisma.botSubscription.findUnique({
      where: {
        patch_bot_subscription_unique: {
          patchId: patchId,
          botId: botId
        }
      }
    });

    if (existingSubscription) {
      return NextResponse.json({ error: 'Bot already connected to this patch' }, { status: 409 });
    }

    // Create new bot subscription
    const botSubscription = await prisma.botSubscription.create({
      data: {
        patchId,
        botId,
        ownerUserId: session.user.id
      },
      include: {
        owner: {
          select: {
            id: true,
            username: true,
            image: true,
            name: true
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
      { error: 'Failed to connect bot to patch' },
      { status: 500 }
    );
  }
}
