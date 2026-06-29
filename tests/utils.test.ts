import { describe, it, expect } from 'vitest';
import { generateId, generateShareToken, getDatesBetween, parseTime, addMinutes, getMinutesBetween, formatDuration } from '../lib/utils';

describe('lib/utils generateId', () => {
  it('produces a v4 UUID string', () => {
    const id = generateId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('produces unique IDs', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => generateId()));
    expect(ids.size).toBe(1000);
  });
});

describe('lib/utils generateShareToken', () => {
  it('produces a 32-char base64url string (24 bytes)', () => {
    const t = generateShareToken();
    // 24 bytes → 32 base64url chars (no padding)
    expect(t).toHaveLength(32);
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('produces unique tokens', () => {
    const tokens = new Set(Array.from({ length: 1000 }, () => generateShareToken()));
    expect(tokens.size).toBe(1000);
  });
});

describe('lib/utils getDatesBetween', () => {
  it('returns inclusive date range', () => {
    expect(getDatesBetween('2026-06-25', '2026-06-27')).toEqual([
      '2026-06-25',
      '2026-06-26',
      '2026-06-27',
    ]);
  });

  it('returns single day when start == end', () => {
    expect(getDatesBetween('2026-06-25', '2026-06-25')).toEqual(['2026-06-25']);
  });

  it('handles month boundary', () => {
    expect(getDatesBetween('2026-06-30', '2026-07-02')).toEqual([
      '2026-06-30',
      '2026-07-01',
      '2026-07-02',
    ]);
  });
});

describe('lib/utils time helpers', () => {
  it('parseTime splits hh:mm', () => {
    expect(parseTime('09:30')).toEqual({ hours: 9, minutes: 30 });
  });

  it('addMinutes wraps within a day', () => {
    expect(addMinutes('23:45', 30)).toBe('00:15');
  });

  it('addMinutes handles zero', () => {
    expect(addMinutes('10:00', 0)).toBe('10:00');
  });

  it('getMinutesBetween computes positive delta', () => {
    expect(getMinutesBetween('09:00', '10:30')).toBe(90);
  });

  it('getMinutesBetween computes negative delta when reversed', () => {
    expect(getMinutesBetween('10:30', '09:00')).toBe(-90);
  });

  it('formatDuration prefers human-readable form', () => {
    expect(formatDuration(45)).toBe('45min');
    expect(formatDuration(60)).toBe('1h');
    expect(formatDuration(90)).toBe('1h 30min');
    expect(formatDuration(180)).toBe('3h');
  });
});
