import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { videoVariantsService } from '@/lib/variantsService';
import { videoIngestService } from '@/lib/ingestService';

export const runtime = 'nodejs';

export async function POST(req: Request, context: { params: Promise<{ userVideoId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userVideoId } = await context.params;
    const body = await req.json();
    const { editManifest, variantKind = 'edit' } = body;

    if (!editManifest) {
      return NextResponse.json({ error: 'Missing editManifest' }, { status: 400 });
    }

    // Verify user owns this video
    const allUserVideos = await videoIngestService.getUserVideos(session.user.id);
    const targetVideo = allUserVideos.find(v => v.id === userVideoId);
    
    if (!targetVideo) {
      return NextResponse.json({ error: 'Video not found or access denied' }, { status: 404 });
    }

    // Create variant
    const result = await videoVariantsService.createVariant({
      userVideoId,
      editManifest,
      variantKind
    });

    return NextResponse.json({
      success: true,
      ...result
    }, { status: 201 });

  } catch (error: any) {
    console.error('[API] Create variant error:', error);
    
    if (error.message?.includes('not found') || error.message?.includes('not ready')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    
    return NextResponse.json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 });
  }
}

export async function GET(req: Request, context: { params: Promise<{ userVideoId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userVideoId } = await context.params;

    // Verify user owns this video
    const allUserVideos = await videoIngestService.getUserVideos(session.user.id);
    const targetVideo = allUserVideos.find(v => v.id === userVideoId);
    
    if (!targetVideo) {
      return NextResponse.json({ error: 'Video not found or access denied' }, { status: 404 });
    }

    // Get variants
    const variants = await videoVariantsService.getVariantsForUserVideo(userVideoId);

    return NextResponse.json({
      success: true,
      variants
    }, { status: 200 });

  } catch (error: any) {
    console.error('[API] Get variants error:', error);
    
    return NextResponse.json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 });
  }
}
