import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ handle: string; id: string }> }
) {
  try {
    const { handle, id } = await params;
    const body = await req.json();
    const { imageUrl } = body;

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'Image URL is required' },
        { status: 400 }
      );
    }

    // Find the patch
    const patch = await prisma.patch.findUnique({
      where: { handle },
      select: { id: true }
    });

    if (!patch) {
      return NextResponse.json(
        { error: 'Patch not found' },
        { status: 404 }
      );
    }

    // Find the content
    const content = await prisma.discoveredContent.findFirst({
      where: {
        id,
        patchId: patch.id
      }
    });

    if (!content) {
      return NextResponse.json(
        { error: 'Content not found' },
        { status: 404 }
      );
    }

    const existingHero = (content.hero as any) || {};
    const heroPayload: Prisma.JsonObject = {
      ...existingHero,
      url: imageUrl,
      source: 'manual-update',
      license: 'generated',
      updatedAt: new Date().toISOString()
    };

    const updatedContent = await prisma.discoveredContent.update({
      where: { id },
      data: {
        hero: heroPayload
      }
    });

    console.log('[Update Image] ✅ Successfully updated content:', id);

    return NextResponse.json({
      success: true,
      content: updatedContent
    });

  } catch (error: any) {
    console.error('[Update Image] Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

