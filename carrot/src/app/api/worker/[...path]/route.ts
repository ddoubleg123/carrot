import { NextRequest } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WORKER_BASE = 'http://localhost:8080';

async function proxy(req: NextRequest, segments: string[]) {
  const path = segments?.length ? `/${segments.join('/')}` : '';
  const search = req.nextUrl.search || '';
  const url = `${WORKER_BASE}${path}${search}`;

  const headers = new Headers(req.headers);
  headers.delete('host');
  headers.delete('x-forwarded-for');
  headers.delete('x-forwarded-host');
  headers.delete('x-forwarded-proto');
  headers.delete('content-length');
  headers.delete('connection');
  headers.delete('accept-encoding');

  try {
    let body: BodyInit | undefined = undefined;
    if (!(req.method === 'GET' || req.method === 'HEAD')) {
      // Read raw body text and sanitize any Next.js RSC JSON prefix ("%JSON%\n")
      let text = await req.text();
      if (text && text.startsWith('%JSON%')) {
        // Strip the RSC marker and any leading newlines
        text = text.replace(/^%JSON%\r?\n?/, '');
      }
      body = text && text.length ? text : undefined;

      // If original content-type was JSON, ensure it is set explicitly
      const ct = req.headers.get('content-type') || '';
      if (ct.toLowerCase().includes('application/json')) {
        headers.set('content-type', 'application/json');
      }
    }

    const init: RequestInit = {
      method: req.method,
      headers,
      body,
      redirect: 'manual',
    };

    const res = await fetch(url, init);
    const resHeaders = new Headers(res.headers);
    // Ensure CORS-friendly defaults
    resHeaders.set('access-control-allow-origin', '*');

    const blob = await res.blob();
    return new Response(blob, { status: res.status, headers: resHeaders });
  } catch (err: any) {
    const msg = (err && (err.message || String(err))) || 'proxy_error';
    return new Response(JSON.stringify({ error: 'proxy_failed', message: msg }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params.path);
}

export async function POST(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params.path);
}

export async function PUT(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params.path);
}

export async function PATCH(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params.path);
}

export async function DELETE(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params.path);
}
