import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { videoIngestService } from '@/lib/ingestService';
import { isSupportedVideoUrl } from '@/lib/urlNormalizer';

export const runtime = 'nodejs';

export async function POST(req: Request, _ctx: { params: Promise<{}> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { url } = body as { url: string };

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid URL' }, { status: 400 });
    }

    // Validate URL is supported
    if (!isSupportedVideoUrl(url)) {
      return NextResponse.json({ 
        error: 'Unsupported video URL. Supported platforms: YouTube, X/Twitter, Reddit' 
      }, { status: 400 });
    }

    // Process ingestion with deduplication
    const result = await videoIngestService.ingestVideo({
      userId: session.user.id,
      url: url.trim()
    });

    return NextResponse.json({
      success: true,
      ...result
    }, { status: 200 });

  } catch (error: any) {
    console.error('[API] Video ingest error:', error);
    
    if (error.message.includes('Invalid') || error.message.includes('Unsupported')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    
    return NextResponse.json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 });
  }
}
