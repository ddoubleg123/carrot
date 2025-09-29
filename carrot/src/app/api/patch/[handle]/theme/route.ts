import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export async function GET(
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

    // Get user's theme for this patch
    const userTheme = await prisma.userPatchTheme.findUnique({
      where: {
        user_patch_theme_unique: {
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
      { error: 'Failed to fetch user patch theme' },
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
    const { mode, preset, imageUrl } = body;

    if (!mode || (mode !== 'preset' && mode !== 'image')) {
      return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
    }

    if (mode === 'preset' && !preset) {
      return NextResponse.json({ error: 'Preset is required for preset mode' }, { status: 400 });
    }

    if (mode === 'image' && !imageUrl) {
      return NextResponse.json({ error: 'Image URL is required for image mode' }, { status: 400 });
    }

    // Upsert user theme
    const userTheme = await prisma.userPatchTheme.upsert({
      where: {
        user_patch_theme_unique: {
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
        patchId,
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
      { error: 'Failed to save user patch theme' },
      { status: 500 }
    );
  }
}
