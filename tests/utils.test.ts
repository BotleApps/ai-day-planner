import { describe, it, expect } from 'vitest';
import {
  generateId,
  generateShareToken,
  getDatesBetween,
  parseTime,
  addMinutes,
  getMinutesBetween,
  formatDuration,
  formatTime,
  formatTimeRange,
  isTimeInRange,
  calculateEndTime,
  hasConflict,
  findFreeSlots,
  reorderActivities,
  compactSchedule,
  calculateDayProgress,
  getTotalDuration,
  groupByType,
  sortByTime,
  cn,
  formatDate,
  getDayOfWeek,
} from '../lib/utils';
import type { Activity, DayPlan } from '../lib/types';

// ─── Small helper so we don't repeat 15 fields per fixture ────────────────
function act(partial: Partial<Activity> & { startTime: string; duration: number }): Activity {
  return {
    id: partial.id ?? `a-${partial.startTime}-${partial.duration}`,
    title: partial.title ?? 'activity',
    type: partial.type ?? 'activity',
    status: partial.status ?? 'planned',
    order: partial.order ?? 0,
    ...partial,
  };
}

// ─── existing coverage ────────────────────────────────────────────────────

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
      '2026-06-25', '2026-06-26', '2026-06-27',
    ]);
  });

  it('returns single day when start == end', () => {
    expect(getDatesBetween('2026-06-25', '2026-06-25')).toEqual(['2026-06-25']);
  });

  it('handles month boundary', () => {
    expect(getDatesBetween('2026-06-30', '2026-07-02')).toEqual([
      '2026-06-30', '2026-07-01', '2026-07-02',
    ]);
  });

  it('handles year boundary', () => {
    expect(getDatesBetween('2026-12-30', '2027-01-02')).toEqual([
      '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02',
    ]);
  });

  it('returns empty when end < start', () => {
    expect(getDatesBetween('2026-06-25', '2026-06-20')).toEqual([]);
  });
});

describe('lib/utils time helpers', () => {
  it('parseTime splits hh:mm', () => {
    expect(parseTime('09:30')).toEqual({ hours: 9, minutes: 30 });
  });

  it('formatTime zero-pads both fields', () => {
    expect(formatTime(9, 5)).toBe('09:05');
    expect(formatTime(0, 0)).toBe('00:00');
    expect(formatTime(23, 59)).toBe('23:59');
  });

  it('addMinutes wraps within a day', () => {
    expect(addMinutes('23:45', 30)).toBe('00:15');
  });

  it('addMinutes handles zero', () => {
    expect(addMinutes('10:00', 0)).toBe('10:00');
  });

  it('addMinutes handles multi-day rollover (modulo 24h)', () => {
    // 10:00 + 25*60 mins = 11:00 next day → still 11:00 in HH:MM
    expect(addMinutes('10:00', 25 * 60)).toBe('11:00');
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

  it('formatTimeRange composes start and end', () => {
    expect(formatTimeRange('10:00', 90)).toBe('10:00 - 11:30');
    // Wrap boundary shows wall-clock end, not "+1d"
    expect(formatTimeRange('23:30', 45)).toBe('23:30 - 00:15');
  });

  it('isTimeInRange treats end as EXCLUSIVE', () => {
    expect(isTimeInRange('09:00', '09:00', '10:00')).toBe(true);
    expect(isTimeInRange('09:59', '09:00', '10:00')).toBe(true);
    // Exact end must NOT be in range (adjacent activities do not conflict).
    expect(isTimeInRange('10:00', '09:00', '10:00')).toBe(false);
    expect(isTimeInRange('10:01', '09:00', '10:00')).toBe(false);
  });
});

// ─── scheduling — the risky bits ──────────────────────────────────────────

describe('lib/utils hasConflict', () => {
  it('flags exact overlap', () => {
    const existing = [act({ startTime: '09:00', duration: 60 })];
    const conflict = hasConflict({ startTime: '09:00', duration: 60 }, existing);
    expect(conflict).not.toBeNull();
  });

  it('flags partial overlap where new starts inside existing', () => {
    const existing = [act({ startTime: '09:00', duration: 60 })];
    const conflict = hasConflict({ startTime: '09:30', duration: 60 }, existing);
    expect(conflict).not.toBeNull();
  });

  it('flags partial overlap where existing starts inside new', () => {
    const existing = [act({ startTime: '09:30', duration: 30 })];
    const conflict = hasConflict({ startTime: '09:00', duration: 60 }, existing);
    expect(conflict).not.toBeNull();
  });

  it('does NOT flag adjacent activities (A ends at 10:00, B starts at 10:00)', () => {
    // The single most important invariant: back-to-back activities must be
    // allowed. If this flips, users can't chain a lunch after a morning
    // event without an artificial gap.
    const existing = [act({ startTime: '09:00', duration: 60 })];
    const conflict = hasConflict({ startTime: '10:00', duration: 60 }, existing);
    expect(conflict).toBeNull();
  });

  it('returns null when the new activity is entirely before existing', () => {
    const existing = [act({ startTime: '15:00', duration: 60 })];
    expect(hasConflict({ startTime: '10:00', duration: 60 }, existing)).toBeNull();
  });

  it('returns null when there are no existing activities', () => {
    expect(hasConflict({ startTime: '10:00', duration: 60 }, [])).toBeNull();
  });
});

describe('lib/utils calculateEndTime', () => {
  it('adds duration to startTime', () => {
    expect(calculateEndTime(act({ startTime: '10:00', duration: 45 }))).toBe('10:45');
  });

  it('wraps across midnight when duration pushes past 24:00', () => {
    expect(calculateEndTime(act({ startTime: '23:30', duration: 60 }))).toBe('00:30');
  });
});

describe('lib/utils findFreeSlots', () => {
  it('returns full day as one slot when there are no activities', () => {
    const slots = findFreeSlots([], '08:00', '22:00', 30);
    expect(slots).toEqual([{ start: '08:00', end: '22:00', isFree: true }]);
  });

  it('returns the gap before the first activity', () => {
    const activities = [act({ startTime: '10:00', duration: 60 })];
    const slots = findFreeSlots(activities, '08:00', '22:00', 30);
    expect(slots[0]).toEqual({ start: '08:00', end: '10:00', isFree: true });
  });

  it('returns the tail after the last activity', () => {
    const activities = [act({ startTime: '10:00', duration: 60 })];
    const slots = findFreeSlots(activities, '08:00', '22:00', 30);
    const last = slots[slots.length - 1];
    expect(last).toEqual({ start: '11:00', end: '22:00', isFree: true });
  });

  it('respects the minimum-duration filter', () => {
    const activities = [
      act({ startTime: '08:00', duration: 60 }),  // 08-09
      act({ startTime: '09:15', duration: 60 }),  // 09:15-10:15  (15min gap: filtered out)
      act({ startTime: '11:00', duration: 60 }),  // 11-12
    ];
    // With minDuration=30, the 15-min gap 09:00–09:15 is not returned.
    const slots = findFreeSlots(activities, '08:00', '22:00', 30);
    const has15minGap = slots.some(s => s.start === '09:00' && s.end === '09:15');
    expect(has15minGap).toBe(false);
    // But the 45-min gap 10:15–11:00 IS returned.
    const has45min = slots.some(s => s.start === '10:15' && s.end === '11:00');
    expect(has45min).toBe(true);
  });
});

describe('lib/utils reorderActivities', () => {
  it('moves an item and reindexes order', () => {
    const a = act({ id: 'a', startTime: '08:00', duration: 30, order: 0 });
    const b = act({ id: 'b', startTime: '09:00', duration: 30, order: 1 });
    const c = act({ id: 'c', startTime: '10:00', duration: 30, order: 2 });
    const out = reorderActivities([a, b, c], 0, 2);
    expect(out.map(x => x.id)).toEqual(['b', 'c', 'a']);
    expect(out.map(x => x.order)).toEqual([0, 1, 2]);
  });

  it('is a no-op when startIndex == endIndex', () => {
    const a = act({ id: 'a', startTime: '08:00', duration: 30, order: 0 });
    const b = act({ id: 'b', startTime: '09:00', duration: 30, order: 1 });
    const out = reorderActivities([a, b], 1, 1);
    expect(out.map(x => x.id)).toEqual(['a', 'b']);
  });
});

describe('lib/utils compactSchedule', () => {
  it('packs activities back-to-back starting from dayStart', () => {
    const a = act({ id: 'a', startTime: '09:00', duration: 45, order: 0 });
    const b = act({ id: 'b', startTime: '11:00', duration: 30, order: 1 });
    const out = compactSchedule([a, b], '08:00');
    expect(out[0].startTime).toBe('08:00');
    expect(out[1].startTime).toBe('08:45');
  });

  it('preserves duration but not gaps', () => {
    const a = act({ id: 'a', startTime: '09:00', duration: 60, order: 0 });
    const b = act({ id: 'b', startTime: '14:00', duration: 30, order: 1 });
    const out = compactSchedule([a, b], '08:00');
    expect(out.map(x => x.duration)).toEqual([60, 30]);
  });
});

describe('lib/utils calculateDayProgress', () => {
  const day = (activities: Activity[]): DayPlan => ({
    id: 'd', date: '2026-07-01', dayNumber: 1, activities,
  });

  it('returns 0% for an empty day (no divide-by-zero)', () => {
    expect(calculateDayProgress(day([]))).toEqual({ total: 0, completed: 0, percentage: 0 });
  });

  it('counts completed AND skipped as done', () => {
    const acts = [
      act({ id: '1', startTime: '08:00', duration: 30, status: 'completed' }),
      act({ id: '2', startTime: '09:00', duration: 30, status: 'skipped' }),
      act({ id: '3', startTime: '10:00', duration: 30, status: 'planned' }),
    ];
    const p = calculateDayProgress(day(acts));
    expect(p).toEqual({ total: 3, completed: 2, percentage: 67 });
  });

  it('rounds percentage to nearest integer', () => {
    const acts = [
      act({ id: '1', startTime: '08:00', duration: 30, status: 'completed' }),
      act({ id: '2', startTime: '09:00', duration: 30, status: 'planned' }),
      act({ id: '3', startTime: '10:00', duration: 30, status: 'planned' }),
    ];
    // 1/3 = 0.333 → rounds to 33
    expect(calculateDayProgress(day(acts)).percentage).toBe(33);
  });
});

describe('lib/utils misc collection helpers', () => {
  it('getTotalDuration sums durations', () => {
    expect(getTotalDuration([
      act({ startTime: '08:00', duration: 30 }),
      act({ startTime: '09:00', duration: 90 }),
    ])).toBe(120);
  });

  it('groupByType groups by ActivityType', () => {
    const meal = act({ id: 'm', startTime: '12:00', duration: 30, type: 'meal' });
    const walk = act({ id: 'w', startTime: '13:00', duration: 30, type: 'activity' });
    const groups = groupByType([meal, walk]);
    expect(groups.meal).toHaveLength(1);
    expect(groups.activity).toHaveLength(1);
  });

  it('sortByTime returns a new sorted array (stable start-time sort)', () => {
    const a = act({ id: 'a', startTime: '10:00', duration: 30 });
    const b = act({ id: 'b', startTime: '08:00', duration: 30 });
    const c = act({ id: 'c', startTime: '09:00', duration: 30 });
    const sorted = sortByTime([a, b, c]);
    expect(sorted.map(x => x.id)).toEqual(['b', 'c', 'a']);
    // Purity: input untouched.
    expect([a, b, c].map(x => x.id)).toEqual(['a', 'b', 'c']);
  });

  it('cn concatenates truthy classnames only', () => {
    expect(cn('a', false, undefined, 'b', null, 'c')).toBe('a b c');
    expect(cn()).toBe('');
  });
});

describe('lib/utils date formatters', () => {
  it('formatDate produces "Weekday Mon DD" shape', () => {
    // 2026-07-01 is a Wednesday. Locale-dependent but shape is stable.
    const out = formatDate('2026-07-01');
    expect(out).toMatch(/^[A-Z][a-z]{2}, [A-Z][a-z]{2} \d{1,2}$/);
  });

  it('getDayOfWeek returns the full weekday name', () => {
    expect(getDayOfWeek('2026-07-01')).toBe('Wednesday');
  });
});
