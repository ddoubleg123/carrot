import NextAuth from "next-auth";
import { authOptions } from "@/auth";

// Next 15: export typed request handlers by initializing here
export const { GET, POST } = NextAuth(authOptions);

// Optional (keep if you need Node runtime or dynamic):
export const runtime = "nodejs";
export const dynamic = "force-dynamic";