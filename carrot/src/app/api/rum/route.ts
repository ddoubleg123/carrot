import { NextResponse } from 'next/server';

// Minimal RUM intake. We can later wire to a DB or external analytics.
// Accepts POST JSON body with { type, value, tags }
export async function POST(req: Request, _ctx: { params: Promise<{}> }): Promise<Response> {
  try {
    const data = await req.json().catch(() => ({}));
    // Best-effort logging (server console only)
    try {
      console.log('[RUM]', JSON.stringify({
        ts: Date.now(),
        ip: req.headers.get('x-forwarded-for') || 'n/a',
        ua: req.headers.get('user-agent') || 'n/a',
        ...data,
      }));
    } catch {}
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return NextResponse.json({ error: 'bad request' }, { status: 400 });
  }
}

export async function GET(_req: Request, _ctx: { params: Promise<{}> }): Promise<Response> {
  // Not supported for collection
  return NextResponse.json({ ok: true }, { status: 200 });
}
