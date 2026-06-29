// Minimal in-memory token-bucket rate limiter.
//
// CAVEAT: This is per-process, so on multi-instance deployments each
// instance enforces its own bucket — total throughput is `instances × limit`.
// On Render's `starter` plan there's one instance, so this is effective.
// For >1 instance, replace with Render Redis (@upstash/ratelimit) or a
// shared Postgres counter.

interface Bucket {
  tokens: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Sweep stale buckets occasionally so the Map doesn't grow unbounded
let lastSweep = 0;
const SWEEP_INTERVAL_MS = 60_000;

function sweep(now: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, b] of buckets.entries()) {
    if (b.resetAt < now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  ok: boolean;
  retryAfterMs: number;
  remaining: number;
}

/**
 * Check whether the given key is within its rate limit window.
 * @param key  Unique identifier — e.g. `chat:${userId}` or `share:${ip}`.
 * @param limit  Maximum requests allowed in the window.
 * @param windowMs  Window size in milliseconds.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { tokens: limit - 1, resetAt: now + windowMs });
    return { ok: true, retryAfterMs: 0, remaining: limit - 1 };
  }

  if (bucket.tokens <= 0) {
    return { ok: false, retryAfterMs: Math.max(0, bucket.resetAt - now), remaining: 0 };
  }

  bucket.tokens -= 1;
  return { ok: true, retryAfterMs: 0, remaining: bucket.tokens };
}

/** Extract a stable IP key from a request (best-effort behind reverse proxies). */
export function getClientIp(req: { headers: Headers }): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}
