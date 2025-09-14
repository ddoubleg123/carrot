import { NextResponse } from 'next/server';

// Simple in-memory counters (ephemeral in serverless is fine)
const COUNTS: Record<string, number> = Object.create(null);
let lastFlush = Date.now();
const FLUSH_INTERVAL_MS = 60_000; // 1 minute

function bump(type: string) {
  COUNTS[type] = (COUNTS[type] || 0) + 1;
}

function maybeFlush() {
  const now = Date.now();
  if (now - lastFlush >= FLUSH_INTERVAL_MS) {
    try {
      const snapshot = { ...COUNTS };
      for (const k of Object.keys(COUNTS)) delete COUNTS[k];
      lastFlush = now;
      console.log('[api/rum] minute metrics', snapshot);
    } catch {}
  }
}

// Accepts POST JSON body with { type, value?, tags? }
export async function POST(req: Request): Promise<Response> {
  try {
    const data = await req.json().catch(() => ({}));
    const type = String(data?.type || 'unknown');
    bump(type);
    maybeFlush();
  } catch {}
  return NextResponse.json({ ok: true });
}

// Lightweight visibility endpoint
export async function GET(_req: Request): Promise<Response> {
  return NextResponse.json({ counts: COUNTS, lastFlush });
}

