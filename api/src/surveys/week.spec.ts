import { describe, it, expect } from 'vitest';
import { getWeekStart } from './week.js';

describe('getWeekStart', () => {
  it('returns the same date (midnight UTC) when given a Monday', () => {
    expect(getWeekStart(new Date('2026-09-14T15:30:00Z'))).toEqual(new Date('2026-09-14T00:00:00Z'));
  });

  it('rolls a mid-week date back to that week\'s Monday', () => {
    expect(getWeekStart(new Date('2026-09-16T09:00:00Z'))).toEqual(new Date('2026-09-14T00:00:00Z'));
  });

  it('rolls Sunday back to the *preceding* Monday, not forward', () => {
    expect(getWeekStart(new Date('2026-09-20T23:59:00Z'))).toEqual(new Date('2026-09-14T00:00:00Z'));
  });

  it('is stable across a week boundary — Sunday night and the next Monday morning differ', () => {
    const sunday = getWeekStart(new Date('2026-09-20T23:59:00Z'));
    const monday = getWeekStart(new Date('2026-09-21T00:01:00Z'));
    expect(monday.getTime()).toBeGreaterThan(sunday.getTime());
  });

  it('ignores local time-of-day components, using UTC calendar date only', () => {
    expect(getWeekStart(new Date('2026-09-16T00:00:00.000Z'))).toEqual(getWeekStart(new Date('2026-09-16T23:59:59.999Z')));
  });
});
