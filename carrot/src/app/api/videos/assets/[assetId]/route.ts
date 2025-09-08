import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { videoIngestService } from '@/lib/ingestService';

export const runtime = 'nodejs';

export async function GET(req: Request, context: { params: Promise<{ assetId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { assetId } = await context.params;

    // Get asset with user access check
    const asset = await videoIngestService.getAsset(assetId);
    
    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    // Check if user has access to this asset
    const hasAccess = asset.userVideos.some(uv => uv.userId === session.user.id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      asset
    }, { status: 200 });

  } catch (error: any) {
    console.error('[API] Get asset error:', error);
    
    return NextResponse.json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 });
  }
}
