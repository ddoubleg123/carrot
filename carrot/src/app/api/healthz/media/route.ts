import { NextResponse } from 'next/server';

// Media proxy health: fetches a small external icon via /api/img to verify proxy works.
// Optionally, you can pass a storage path to test Firebase Admin download, e.g.:
//   /api/healthz/media?path=users/demo/avatars/example.png
export const runtime = 'nodejs';

export async function GET(req: Request, _ctx: { params: Promise<{}> }) {
  try {
    const { searchParams } = new URL(req.url);
    const testPath = searchParams.get('path');
    const origin = new URL(req.url).origin;

    // 1) Test generic URL fetch through proxy (should be publicly available)
    const publicTest = 'https://httpbin.org/image/png';
    const urlProbe = await fetch(`${origin}/api/img?url=${encodeURIComponent(publicTest)}`, { cache: 'no-store' }).catch(() => null);
    if (!urlProbe || !urlProbe.ok) {
      return NextResponse.json({ ok: false, error: 'proxy_url_failed', status: urlProbe?.status ?? 'no_response' }, { status: 503 });
    }

    // 2) Optional path test (requires Firebase Admin configured and readable object)
    if (testPath) {
      const pathProbe = await fetch(`${origin}/api/img?path=${encodeURIComponent(testPath)}`, { cache: 'no-store' }).catch(() => null);
      if (!pathProbe || !pathProbe.ok) {
        return NextResponse.json({ ok: false, error: 'proxy_path_failed', status: pathProbe?.status ?? 'no_response', path: testPath }, { status: 503 });
      }
    }

    return NextResponse.json({ ok: true, status: 'healthy', tested: { url: true, path: Boolean(testPath) } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
