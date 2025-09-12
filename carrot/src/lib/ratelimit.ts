// Simple in-memory sliding window rate limiter (per-process).
// Good enough for dev/small scale. For multi-instance, move to Redis.

export type RateResult = { ok: true } | { ok: false; retryAfterMs: number };

type Entry = { ts: number };
const buckets = new Map<string, Entry[]>();

/**
 * Allow at most `limit` events per `windowMs`.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateResult {
  const now = Date.now();
  const arr = buckets.get(key) || [];
  // Drop old entries
  const cutoff = now - windowMs;
  const fresh = arr.filter(e => e.ts > cutoff);
  if (fresh.length >= limit) {
    const retryAfterMs = Math.max(0, windowMs - (now - fresh[0].ts));
    buckets.set(key, fresh);
    return { ok: false, retryAfterMs };
  }
  fresh.push({ ts: now });
  buckets.set(key, fresh);
  return { ok: true };
}
