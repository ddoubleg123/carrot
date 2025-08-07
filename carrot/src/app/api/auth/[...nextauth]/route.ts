
import NextAuth from "next-auth";
import { authOptions } from "@/auth";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };

export const dynamic = 'force-dynamic'; // Ensure the route is dynamic
export const runtime = 'nodejs'; // Ensure we're using Node.js runtime
