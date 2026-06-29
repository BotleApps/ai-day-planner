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
});
