import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: patchId } = await context.params;

    const userTheme = await prisma.userPatchTheme.findUnique({
      where: {
        userId_patchId: {
          userId: session.user.id,
          patchId: patchId
        }
      }
    });

    return NextResponse.json({
      success: true,
      theme: userTheme || { mode: 'preset', preset: 'light' }
    });
  } catch (error) {
    console.error('Error fetching user patch theme:', error);
    return NextResponse.json(
      { error: 'Failed to fetch theme' },
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
    const { mode, preset, imageUrl } = body;

    // Validate input
    if (!mode || !['preset', 'image'].includes(mode)) {
      return NextResponse.json(
        { error: 'Invalid mode. Must be "preset" or "image"' },
        { status: 400 }
      );
    }

    if (mode === 'preset' && !['light', 'warm', 'stone', 'civic', 'ink'].includes(preset)) {
      return NextResponse.json(
        { error: 'Invalid preset. Must be one of: light, warm, stone, civic, ink' },
        { status: 400 }
      );
    }

    if (mode === 'image' && !imageUrl) {
      return NextResponse.json(
        { error: 'imageUrl is required when mode is "image"' },
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

    // Upsert user theme
    const userTheme = await prisma.userPatchTheme.upsert({
      where: {
        userId_patchId: {
          userId: session.user.id,
          patchId: patchId
        }
      },
      update: {
        mode,
        preset: mode === 'preset' ? preset : null,
        imageUrl: mode === 'image' ? imageUrl : null
      },
      create: {
        userId: session.user.id,
        patchId: patchId,
        mode,
        preset: mode === 'preset' ? preset : null,
        imageUrl: mode === 'image' ? imageUrl : null
      }
    });

    return NextResponse.json({
      success: true,
      theme: userTheme
    });
  } catch (error) {
    console.error('Error saving user patch theme:', error);
    return NextResponse.json(
      { error: 'Failed to save theme' },
      { status: 500 }
    );
  }
}
