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
    // Use a reliable asset host to avoid blocked/unstable endpoints
    const publicTest = 'https://github.githubassets.com/favicon.ico';
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 6000);
    // Prefer relative path to avoid self-DNS issues in some hosts
    let urlProbe: any = await fetch(`/api/img?url=${encodeURIComponent(publicTest)}`, { cache: 'no-store', signal: ctrl.signal }).catch((e) => ({ ok: false, status: 599, error: String(e?.message || e) }));
    if (!urlProbe || !urlProbe.ok) {
      // Fallback to absolute and then direct external fetch to distinguish issues
      urlProbe = await fetch(`${origin}/api/img?url=${encodeURIComponent(publicTest)}`, { cache: 'no-store', signal: ctrl.signal }).catch((e) => ({ ok: false, status: 599, error: String(e?.message || e) }));
      if (!urlProbe || !urlProbe.ok) {
        // As a last check, verify outbound internet is fine by fetching the external URL directly
        const direct = await fetch(publicTest, { cache: 'no-store', signal: ctrl.signal }).catch((e) => ({ ok: false, status: 598, error: String(e?.message || e) } as any));
        clearTimeout(timeout);
        return NextResponse.json({ ok: false, error: 'proxy_url_failed', status: (urlProbe as any)?.status ?? 'no_response', directStatus: (direct as any)?.status }, { status: 503 });
      }
    }
    clearTimeout(timeout);

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
