import { handlers } from "@/auth";

// Next 15: export typed request handlers from initialized handlers
export const GET = handlers.GET;
export const POST = handlers.POST;

// Optional (keep if you need Node runtime or dynamic):
export const runtime = "nodejs";
export const dynamic = "force-dynamic";