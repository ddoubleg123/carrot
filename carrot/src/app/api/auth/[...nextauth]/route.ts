import { handlers } from "../../../../auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Export typed GET/POST handlers expected by Next.js 15
export const GET = handlers.GET;
export const POST = handlers.POST;

if (process.env.NODE_ENV !== 'production') {
  try { console.log('[NextAuth] route handlers initialized (GET, POST)'); } catch {}
}