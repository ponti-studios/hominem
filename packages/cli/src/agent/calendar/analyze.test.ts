import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { analyzeEvents, calendarEnvelope, humanCalendar, normalizeEvents } from './analyze.ts';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'hominem-calendar-'));
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(dir, { recursive: true, force: true });
});

describe('calendar analysis', () => {
  it('prints calendar help without selecting an action', async () => {
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const { main } = await import('./main.ts');
    expect(await main(['--help'])).toBe(0);
    expect(String(spy.mock.calls[0]?.[0])).toContain('hominem calendar');
  });

  it('prints analyze help without running a pull', async () => {
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const { main } = await import('./analyze.ts');
    expect(await main(['analyze', '--help'])).toBe(0);
    expect(String(spy.mock.calls[0]?.[0])).toContain('hominem calendar analyze');
    spy.mockRestore();
  });

  it('prints calendar help without selecting an action', async () => {
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const { main } = await import('./main.ts');
    expect(await main(['--help'])).toBe(0);
    expect(String(spy.mock.calls[0]?.[0])).toContain('hominem calendar');
  });

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

  it('does not overlap timed events with a flat all-day event', () => {
    const events = normalizeEvents([
      {
        id: 'birthday',
        summary: "Bridgette Logan's birthday",
        start: '2026-12-09',
        end: '2026-12-10',
        location: '',
      },
      {
        id: 'sleep',
        summary: 'Sleep',
        start: '2026-12-09T22:00:00Z',
        end: '2026-12-10T06:00:00Z',
        location: '',
      },
      {
        id: 'grooming',
        summary: 'Grooming',
        start: '2026-12-09T09:00:00Z',
        end: '2026-12-09T09:30:00Z',
        location: '',
      },
    ]);
    const report = analyzeEvents(events, '2026-12-09', '2026-12-09');
    expect(report.overlaps).toEqual([]);
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

  it('renders a compact human summary', () => {
    const report = analyzeEvents(
      normalizeEvents([
        {
          id: 'breakfast',
          summary: 'Breakfast',
          start: { dateTime: '2026-11-26T13:00:00Z' },
          end: { dateTime: '2026-11-26T13:30:00Z' },
        },
      ]),
      '2026-11-26',
      '2026-11-26',
    );
    expect(humanCalendar(report)).toContain('Calendar — 2026-11-26');
    expect(humanCalendar(report)).toContain('1 event');
  });

  it('returns a stable JSON envelope with artifact paths', () => {
    const report = analyzeEvents([], '2026-11-26', '2026-11-26');
    const envelope = calendarEnvelope(
      report,
      'cache',
      42,
      '/tmp/cache.json',
      '/tmp/report.json',
      '/tmp/report.md',
    );
    expect(envelope).toMatchObject({
      ok: true,
      event_count: 0,
      source: 'cache',
      run_id: 42,
      summary: {
        overlaps: 0,
        duplicates: 0,
        violations: 0,
      },
      artifacts: {
        cache: '/tmp/cache.json',
        report_json: '/tmp/report.json',
        report_markdown: '/tmp/report.md',
      },
    });
  });

  it('does not overlap timed events with all-day birthdays', () => {
    const events = normalizeEvents([
      {
        id: 'birthday',
        summary: "Bridgette Logan's birthday",
        start: '2026-12-09',
        end: '2026-12-10',
        location: '',
      },
      {
        id: 'grooming',
        summary: 'Grooming',
        start: { dateTime: '2026-12-09T09:00:00Z' },
        end: { dateTime: '2026-12-09T09:30:00Z' },
      },
    ]);
    expect(analyzeEvents(events, '2026-12-09', '2026-12-09').overlaps).toEqual([]);
  });

  it('deduplicates repeated standing violations', () => {
    const events = normalizeEvents([
      {
        id: 'duplicate-1',
        summary: 'GTA VI — story mode',
        start: { dateTime: '2026-12-08T10:00:00Z' },
        end: { dateTime: '2026-12-08T11:00:00Z' },
      },
      {
        id: 'duplicate-2',
        summary: 'GTA VI — story mode',
        start: { dateTime: '2026-12-08T10:00:00Z' },
        end: { dateTime: '2026-12-08T11:00:00Z' },
      },
    ]);
    const report = analyzeEvents(events, '2026-12-08', '2026-12-08');
    expect(report.duplicates).toHaveLength(1);
    expect(report.violations).toHaveLength(1);
  });
});
