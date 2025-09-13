import NextAuth from "next-auth";

// Build handlers on-demand to avoid module order issues in dev
async function getHandlers() {
  try {
    const mod: any = await import('@/auth');
    const options = (mod?.authOptions) || (mod?.default?.authOptions);
    if (!options) throw new Error('authOptions missing');
    const handlers = NextAuth(options as any);
    if (!handlers?.GET || !handlers?.POST) throw new Error('Built handlers missing');
    if (process.env.NODE_ENV !== 'production') {
      try { console.log('[NextAuth] handlers built dynamically'); } catch {}
    }
    return handlers;
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') {
      try { console.error('[NextAuth] failed to build handlers dynamically', e); } catch {}
    }
    // Last resort: try static imports
    try {
      const mod: any = await import('@/auth');
      return mod.handlers || mod.default?.handlers || null;
    } catch {
      return null;
    }
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const h = await getHandlers();
  if (!h?.GET) return new Response(JSON.stringify({ error: 'Auth handlers not ready' }), { status: 500, headers: { 'content-type': 'application/json' } });
  return h.GET(req as any);
}

export async function POST(req: Request) {
  const h = await getHandlers();
  if (!h?.POST) return new Response(JSON.stringify({ error: 'Auth handlers not ready' }), { status: 500, headers: { 'content-type': 'application/json' } });
  return h.POST(req as any);
}