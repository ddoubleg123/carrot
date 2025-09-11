import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

// Simple audio proxy to bypass CORS for development/testing.
// Supports Range requests and streams bytes from the remote source.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const target = searchParams.get('url');
    if (!target) {
      return NextResponse.json({ error: 'Missing url param' }, { status: 400 });
    }

    // Basic allowlist: only http/https
    if (!/^https?:\/\//i.test(target)) {
      return NextResponse.json({ error: 'Invalid url' }, { status: 400 });
    }

    // Forward Range and basic headers for media streaming
    const range = req.headers.get('range') || undefined;
    const controller = new AbortController();
    const res = await fetch(target, {
      method: 'GET',
      headers: {
        ...(range ? { Range: range } : {}),
        // Some servers require a UA to send partial content
        'User-Agent': 'CarrotAudioProxy/1.0 (+https://localhost)'
      },
      redirect: 'follow',
      signal: controller.signal,
      cache: 'no-store',
    });

    if (!res.ok && res.status !== 206) {
      const text = await res.text().catch(() => '');
      return new NextResponse(text || 'Upstream fetch failed', {
        status: res.status,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Vary': 'Origin',
        },
      });
    }

    // Stream the body through, preserving important headers
    const headers = new Headers();
    // CORS
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Vary', 'Origin');
    // Content type and range headers
    const ctype = res.headers.get('content-type') || 'audio/mpeg';
    headers.set('Content-Type', ctype);
    const clength = res.headers.get('content-length');
    if (clength) headers.set('Content-Length', clength);
    const crange = res.headers.get('content-range');
    if (crange) headers.set('Content-Range', crange);
    const acceptsRanges = res.headers.get('accept-ranges');
    headers.set('Accept-Ranges', acceptsRanges || 'bytes');
    // Cache headers - avoid caching in dev
    headers.set('Cache-Control', 'no-store');

    return new NextResponse(res.body, {
      status: res.status === 206 ? 206 : 200,
      headers,
    });
  } catch (e: any) {
    console.error('[proxy-audio] Error:', e);
    return NextResponse.json({ error: 'Proxy error', details: String(e?.message || e) }, { status: 500 });
  }
}
