import NextAuth from "next-auth";
import { authOptions } from "../../../../auth";

// Use direct handler to avoid undefined handlers in certain dev environments
const handler = NextAuth(authOptions as any);
export { handler as GET, handler as POST };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";