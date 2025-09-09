import { handlers } from "@/auth";

// Next 15: export typed request handlers
export const { GET, POST } = handlers;

// Optional (keep if you need Node runtime or dynamic):
export const runtime = "nodejs";
export const dynamic = "force-dynamic";