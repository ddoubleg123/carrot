import NextAuth from "next-auth";

// Build/resolve handlers on-demand to avoid module order issues in dev and to satisfy TS types
async function getHandlers(): Promise<{ GET: any; POST: any } | null> {
  try {
    const mod: any = await import('@/auth');
    // Prefer directly exported handlers
    const exported = mod?.handlers || mod?.default?.handlers;
    if (exported?.GET && exported?.POST) return exported;

    // Else, construct via NextAuth(authOptions) and use the nested .handlers
    const options = mod?.authOptions || mod?.default?.authOptions;
    if (options) {
      const constructed: any = NextAuth(options as any);
      const built = constructed?.handlers;
      if (built?.GET && built?.POST) {
        if (process.env.NODE_ENV !== 'production') {
          try { console.log('[NextAuth] handlers constructed dynamically'); } catch {}
        }
        return built as { GET: any; POST: any };
      }
    }
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') {
      try { console.error('[NextAuth] getHandlers error', e); } catch {}
    }
  }
  return null;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: any) {
  const h = await getHandlers();
  if (!h?.GET) return new Response(JSON.stringify({ error: 'Auth handlers not ready' }), { status: 500, headers: { 'content-type': 'application/json' } });
  return h.GET(req as any, ctx as any);
}

export async function POST(req: Request, ctx: any) {
  const h = await getHandlers();
  if (!h?.POST) return new Response(JSON.stringify({ error: 'Auth handlers not ready' }), { status: 500, headers: { 'content-type': 'application/json' } });
  return h.POST(req as any, ctx as any);
}