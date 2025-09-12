import NextAuth from "next-auth";
import { authOptions } from "../../../../auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Create a single handler and export it for all HTTP verbs we need
const handler = NextAuth(authOptions as any);
if (process.env.NODE_ENV !== 'production') {
  try { console.log('[NextAuth] route handler initialized'); } catch {}
}
export { handler as GET, handler as POST, handler as HEAD, handler as OPTIONS };