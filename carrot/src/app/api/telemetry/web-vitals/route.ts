import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { metric, value, path, ts, ...rest } = body || {};

    // Minimal validation
    const m = typeof metric === 'string' ? metric : 'unknown';
    const v = typeof value === 'number' ? value : Number(value) || 0;
    const p = typeof path === 'string' ? path : 'unknown';

    // Log in dev; in prod this can be forwarded to an analytics sink
    if (process.env.NODE_ENV !== 'production') {
      console.log('[web-vitals]', { metric: m, value: v, path: p, ts: ts || Date.now(), ...rest });
    }

    // No content response to keep it cheap
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return NextResponse.json({ error: 'telemetry_error' }, { status: 400 });
  }
}
