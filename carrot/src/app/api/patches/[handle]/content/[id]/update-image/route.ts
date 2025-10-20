import { NextRequest, NextResponse } from 'next/server';
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

    // Update the content with new image
    const updatedContent = await prisma.discoveredContent.update({
      where: { id },
      data: {
        mediaAssets: {
          ...(content.mediaAssets as any),
          hero: imageUrl,
          heroImage: {
            url: imageUrl,
            source: 'ai-generated',
            license: 'generated',
            updatedAt: new Date().toISOString()
          }
        }
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

