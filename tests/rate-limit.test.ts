import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { rateLimit, getClientIp } from '../lib/rate-limit';

describe('lib/rate-limit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows the first request and decrements the bucket', () => {
    const r1 = rateLimit('test:1', 3, 1000);
    expect(r1.ok).toBe(true);
    expect(r1.remaining).toBe(2);
  });

  it('blocks when the bucket runs out', () => {
    rateLimit('test:2', 2, 1000);
    rateLimit('test:2', 2, 1000);
    const r3 = rateLimit('test:2', 2, 1000);
    expect(r3.ok).toBe(false);
    expect(r3.remaining).toBe(0);
    expect(r3.retryAfterMs).toBeGreaterThan(0);
  });

  it('refills after the window elapses', () => {
    rateLimit('test:3', 1, 1000);
    expect(rateLimit('test:3', 1, 1000).ok).toBe(false);

    vi.advanceTimersByTime(1001);

    const r = rateLimit('test:3', 1, 1000);
    expect(r.ok).toBe(true);
    expect(r.remaining).toBe(0);
  });

  it('isolates buckets by key', () => {
    rateLimit('test:a', 1, 1000);
    expect(rateLimit('test:a', 1, 1000).ok).toBe(false);
    expect(rateLimit('test:b', 1, 1000).ok).toBe(true);
  });

  it('retryAfterMs decays toward 0 as the window elapses', () => {
    rateLimit('test:decay', 1, 5000);
    rateLimit('test:decay', 1, 5000); // blocked

    const midway = rateLimit('test:decay', 1, 5000);
    expect(midway.ok).toBe(false);
    expect(midway.retryAfterMs).toBeGreaterThan(0);

    vi.advanceTimersByTime(4000);
    const later = rateLimit('test:decay', 1, 5000);
    expect(later.ok).toBe(false);
    expect(later.retryAfterMs).toBeLessThanOrEqual(1000);
  });

  it('never returns NaN or a negative retryAfterMs', () => {
    rateLimit('test:nonneg', 1, 1000);
    // Force the "blocked but almost at resetAt" boundary
    vi.advanceTimersByTime(999);
    const r = rateLimit('test:nonneg', 1, 1000);
    expect(Number.isFinite(r.retryAfterMs)).toBe(true);
    expect(r.retryAfterMs).toBeGreaterThanOrEqual(0);
  });

  it('window boundary: exactly t=resetAt is still in the old window (< check, not <=)', () => {
    // Documented behavior: rateLimit uses `bucket.resetAt < now`, so t=resetAt
    // still belongs to the ORIGINAL window. Refresh happens strictly AFTER.
    rateLimit('test:boundary', 1, 1000);
    expect(rateLimit('test:boundary', 1, 1000).ok).toBe(false);

    vi.advanceTimersByTime(1000);
    // Still blocked at exact boundary.
    expect(rateLimit('test:boundary', 1, 1000).ok).toBe(false);

    vi.advanceTimersByTime(1);
    // One tick past boundary → bucket refreshes.
    expect(rateLimit('test:boundary', 1, 1000).ok).toBe(true);
  });

  it('concurrent calls with the same key never exceed the configured max', async () => {
    // NOTE: rateLimit is synchronous, so "concurrent" in JS means "same tick"
    // via Promise.all resolving synchronous work — this catches any hidden
    // async gap in the future.
    const results = await Promise.all(
      Array.from({ length: 10 }, () => Promise.resolve(rateLimit('test:concurrent', 3, 1000))),
    );
    const okCount = results.filter(r => r.ok).length;
    expect(okCount).toBe(3);
  });

  it('cleanup sweep removes expired buckets after SWEEP_INTERVAL_MS', () => {
    // Populate a bunch of short-lived buckets.
    for (let i = 0; i < 5; i++) rateLimit(`sweep:${i}`, 1, 500);

    // Advance past the buckets' resetAt AND past the sweep interval so the
    // next call triggers cleanup.
    vi.advanceTimersByTime(70_000);

    // A call on a NEW key triggers the sweep before setting itself. The
    // stale entries should be gone; we can't inspect the internal Map
    // directly, but re-invoking each stale key must be treated as a fresh
    // bucket (ok=true with `limit-1` remaining).
    for (let i = 0; i < 5; i++) {
      const r = rateLimit(`sweep:${i}`, 1, 500);
      expect(r.ok).toBe(true);
      expect(r.remaining).toBe(0);
    }
  });
});

describe('lib/rate-limit getClientIp', () => {
  it('returns first IP from X-Forwarded-For when present', () => {
    const h = new Headers({ 'x-forwarded-for': '203.0.113.5, 10.0.0.1, 10.0.0.2' });
    expect(getClientIp({ headers: h })).toBe('203.0.113.5');
  });

  it('falls back to X-Real-IP when no XFF', () => {
    const h = new Headers({ 'x-real-ip': '198.51.100.7' });
    expect(getClientIp({ headers: h })).toBe('198.51.100.7');
  });

  it('returns "unknown" when no headers present', () => {
    expect(getClientIp({ headers: new Headers() })).toBe('unknown');
  });

  it('trims whitespace from X-Forwarded-For first entry', () => {
    const h = new Headers({ 'x-forwarded-for': '   203.0.113.5  , 10.0.0.1' });
    expect(getClientIp({ headers: h })).toBe('203.0.113.5');
  });

  it('prefers X-Forwarded-For over X-Real-IP when both present', () => {
    const h = new Headers({
      'x-forwarded-for': '203.0.113.5',
      'x-real-ip': '198.51.100.7',
    });
    expect(getClientIp({ headers: h })).toBe('203.0.113.5');
  });
});
