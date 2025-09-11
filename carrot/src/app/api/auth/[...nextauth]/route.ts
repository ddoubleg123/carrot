import NextAuth from "next-auth";
import { authOptions } from "../../../../auth";

// NextAuth v5 pattern: NextAuth returns a single handler function
const handler = NextAuth(authOptions as any);
export { handler as GET, handler as POST };

// Optional (keep if you need Node runtime or dynamic):
export const runtime = "nodejs";
export const dynamic = "force-dynamic";