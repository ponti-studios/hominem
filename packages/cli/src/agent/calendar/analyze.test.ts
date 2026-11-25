import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { analyzeEvents, normalizeEvents } from './analyze.ts';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'hominem-calendar-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('calendar analysis', () => {
  it('normalizes timed and all-day events', () => {
    const events = normalizeEvents([
      {
        id: 'event-1',
        summary: 'Lunch',
        location: 'Cincinnati',
        description: '',
        start: { dateTime: '2026-11-26T13:00:00Z' },
        end: { dateTime: '2026-11-26T13:30:00Z' },
      },
      {
        id: 'event-2',
        summary: 'Holiday',
        start: { date: '2026-11-26' },
        end: { date: '2026-11-27' },
      },
    ]);
    expect(events).toHaveLength(2);
    expect(events.map((event) => event.title)).toContain('Lunch');
    expect(events.find((event) => event.title === 'Holiday')?.allDay).toBe(true);
  });

  it('normalizes the flat live GWS event shape', () => {
    const events = normalizeEvents([
      {
        id: 'sleep',
        summary: 'Sleep',
        start: '2026-11-26T03:00:00Z',
        end: '2026-11-26T12:00:00Z',
        location: '',
      },
    ]);
    expect(events[0]?.title).toBe('Sleep');
    expect(events[0]?.allDay).toBe(false);
  });

  it('finds overlaps, duplicates, dead spots, slivers, and sleep anomalies', () => {
    const events = normalizeEvents([
      {
        id: 'sleep',
        summary: 'Sleep',
        start: { dateTime: '2026-11-26T03:00:00Z' },
        end: { dateTime: '2026-11-26T14:00:00Z' },
      },
      {
        id: 'walk',
        summary: 'Morning walk',
        start: { dateTime: '2026-11-26T12:10:00Z' },
        end: { dateTime: '2026-11-26T13:00:00Z' },
      },
      {
        id: 'breakfast',
        summary: 'Breakfast',
        start: { dateTime: '2026-11-26T13:10:00Z' },
        end: { dateTime: '2026-11-26T13:30:00Z' },
      },
      {
        id: 'breakfast-duplicate',
        summary: 'Breakfast',
        start: { dateTime: '2026-11-26T13:10:00Z' },
        end: { dateTime: '2026-11-26T13:30:00Z' },
      },
      {
        id: 'walk-overlap',
        summary: 'Morning walk',
        start: { dateTime: '2026-11-26T12:50:00Z' },
        end: { dateTime: '2026-11-26T13:20:00Z' },
      },
    ]);

    const report = analyzeEvents(events, '2026-11-26', '2026-11-26');
    expect(report.duplicates).toEqual([
      {
        title: 'Breakfast',
        start: '2026-11-26T13:10:00.000Z',
        count: 2,
      },
    ]);
    expect(report.overlaps.length).toBeGreaterThan(0);
    expect(report.deadSpots.length).toBeGreaterThan(0);
    expect(report.sleepAnomalies).toEqual([{ date: '2026-11-26', hours: 11 }]);
  });

  it('rejects malformed event payloads', () => {
    expect(() =>
      normalizeEvents([
        {
          id: 'bad',
          summary: 'Missing bounds',
        },
      ]),
    ).toThrow('has no start/end');
  });
});
