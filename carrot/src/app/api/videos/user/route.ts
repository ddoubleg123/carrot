import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { videoIngestService } from '@/lib/ingestService';

export const runtime = 'nodejs';

export async function GET(req: Request, _ctx: { params: Promise<{}> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all user videos
    const userVideos = await videoIngestService.getUserVideos(session.user.id);

    return NextResponse.json({
      success: true,
      videos: userVideos
    }, { status: 200 });

  } catch (error: any) {
    console.error('[API] Get user videos error:', error);
    
    return NextResponse.json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 });
  }
}
