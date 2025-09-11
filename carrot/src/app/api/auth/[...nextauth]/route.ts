import { handlers } from "../../../../auth";

// NextAuth v5 app router: use generated handlers from src/auth.ts
export const { GET, POST } = handlers;

// Optional runtime hints (safe to keep)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";