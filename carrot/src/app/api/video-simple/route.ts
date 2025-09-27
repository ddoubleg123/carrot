import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

// Simple video proxy - no complex logic, just direct forwarding
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const videoUrl = searchParams.get('url');
    
    if (!videoUrl) {
      return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
    }

    // Decode the URL once
    const decodedUrl = decodeURIComponent(videoUrl);
    
    console.log('[Simple Video] Proxying:', decodedUrl);

    // Simple fetch with short timeout
    const response = await fetch(decodedUrl, {
      method: 'GET',
      headers: {
        'Range': req.headers.get('range') || '',
        'User-Agent': 'CarrotVideoProxy/1.0'
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      console.error('[Simple Video] Fetch failed:', response.status, response.statusText);
      return NextResponse.json({ error: 'Video not found' }, { status: response.status });
    }

    // Stream the response with CORS headers
    const headers = new Headers();
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Range');
    
    // Copy important headers from the original response
    const contentType = response.headers.get('content-type');
    if (contentType) headers.set('Content-Type', contentType);
    
    const contentLength = response.headers.get('content-length');
    if (contentLength) headers.set('Content-Length', contentLength);
    
    const contentRange = response.headers.get('content-range');
    if (contentRange) headers.set('Content-Range', contentRange);
    
    const acceptRanges = response.headers.get('accept-ranges');
    if (acceptRanges) headers.set('Accept-Ranges', acceptRanges);

    return new NextResponse(response.body, {
      status: response.status,
      headers,
    });

  } catch (error) {
    console.error('[Simple Video] Error:', error);
    return NextResponse.json({ error: 'Video proxy failed' }, { status: 500 });
  }
}

export async function HEAD(req: Request) {
  const res = await GET(req);
  return new NextResponse(null, { status: res.status, headers: res.headers });
}
