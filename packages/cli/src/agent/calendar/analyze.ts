import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

import { z } from 'zod';

import { finishRun, logEvent, logRun } from '../log/agent_log.ts';
import { select } from '../select.ts';

const rawEventSchema = z
  .object({
    id: z.string().optional(),
    summary: z.string().optional(),
    location: z.string().optional(),
    description: z.string().optional(),
    recurringEventId: z.string().optional(),
    start: z
      .union([
        z.string(),
        z.object({
          date: z.string().optional(),
          dateTime: z.string().optional(),
        }),
      ])
      .optional(),
    end: z
      .union([
        z.string(),
        z.object({
          date: z.string().optional(),
          dateTime: z.string().optional(),
        }),
      ])
      .optional(),
  })
  .passthrough();

export interface CalendarEvent {
  id: string | null;
  title: string;
  location: string;
  description: string;
  series: string | null;
  allDay: boolean;
  start: Date;
  end: Date;
  localDate: string;
}

export interface CalendarReport {
  ok: true;
  start: string;
  end: string;
  eventCount: number;
  overlaps: Array<{
    date: string;
    a: string;
    b: string;
    minutes: number;
    kind: 'partial' | 'contained';
  }>;
  duplicates: Array<{ title: string; start: string; count: number }>;
  deadSpots: Array<{ date: string; from: string; to: string; minutes: number }>;
  slivers: Array<{ date: string; from: string; to: string; minutes: number }>;
  sleepAnomalies: Array<{ date: string; hours: number }>;
  violations: Array<{ date: string; rule: string; detail: string }>;
  dayStats: Array<{
    date: string;
    eventCount: number;
    coveredMinutes: number;
    wakingMinutes: number;
  }>;
}

export interface CalendarEnvelope {
  ok: true;
  start: string;
  end: string;
  event_count: number;
  source: 'live' | 'cache';
  run_id: number;
  summary: {
    overlaps: number;
    duplicates: number;
    dead_spots: number;
    slivers: number;
    sleep_anomalies: number;
    violations: number;
    covered_minutes: number;
    waking_minutes: number;
  };
  findings: {
    overlaps: CalendarReport['overlaps'];
    duplicates: CalendarReport['duplicates'];
    dead_spots: CalendarReport['deadSpots'];
    slivers: CalendarReport['slivers'];
    sleep_anomalies: CalendarReport['sleepAnomalies'];
    violations: CalendarReport['violations'];
  };
  artifacts: {
    cache: string;
    report_json: string;
    report_markdown: string;
  };
}

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function parseDateTime(value: string): Date {
  return new Date(value);
}

function minutesBetween(start: Date, end: Date): number {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60_000));
}

export function normalizeEvents(raw: unknown[]): CalendarEvent[] {
  const normalized: CalendarEvent[] = [];
  for (const [index, item] of raw.entries()) {
    const parsed = rawEventSchema.safeParse(item);
    if (!parsed.success) throw new Error(`calendar event ${index + 1} failed schema validation`);
    const event = parsed.data;
    const start = event.start ?? {};
    const end = event.end ?? {};
    const allDay =
      (typeof start === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(start)) ||
      (typeof start === 'object' && Boolean(start.date));
    let startDate: Date;
    let endDate: Date;
    if (typeof start === 'string' && typeof end === 'string') {
      startDate = start.length === 10 ? new Date(`${start}T00:00:00.000Z`) : parseDateTime(start);
      endDate = end.length === 10 ? new Date(`${end}T00:00:00.000Z`) : parseDateTime(end);
    } else if (typeof start === 'object' && typeof end === 'object' && start.date && end.date) {
      startDate = new Date(`${start.date}T00:00:00.000Z`);
      endDate = new Date(`${end.date}T00:00:00.000Z`);
    } else if (
      typeof start === 'object' &&
      typeof end === 'object' &&
      start.dateTime &&
      end.dateTime
    ) {
      startDate = parseDateTime(start.dateTime);
      endDate = parseDateTime(end.dateTime);
    } else {
      throw new Error(`calendar event ${event.id ?? index + 1} has no start/end`);
    }
    normalized.push({
      id: event.id ?? null,
      title: (event.summary ?? '(untitled)').trim(),
      location: (event.location ?? '').trim(),
      description: (event.description ?? '').trim(),
      series: event.recurringEventId ?? null,
      allDay,
      start: startDate,
      end: endDate,
      localDate: dateOnly(startDate),
    });
  }
  return normalized.sort((left, right) => left.start.getTime() - right.start.getTime());
}

export function analyzeEvents(events: CalendarEvent[], start: string, end: string): CalendarReport {
  const first = new Date(`${start}T00:00:00.000Z`);
  const last = new Date(`${end}T23:59:59.999Z`);
  const timed = events.filter(
    (event) => !event.allDay && event.start >= first && event.start <= last,
  );
  const overlaps: CalendarReport['overlaps'] = [];
  const duplicates: CalendarReport['duplicates'] = [];
  const deadSpots: CalendarReport['deadSpots'] = [];
  const slivers: CalendarReport['slivers'] = [];
  const sleepAnomalies: CalendarReport['sleepAnomalies'] = [];
  const violations: CalendarReport['violations'] = [];
  const dayStats: CalendarReport['dayStats'] = [];

  const duplicateCount = new Map<string, number>();
  for (const event of timed) {
    const key = `${event.title}|${event.start.toISOString()}`;
    duplicateCount.set(key, (duplicateCount.get(key) ?? 0) + 1);
  }
  for (const [key, count] of duplicateCount) {
    if (count < 2) continue;
    const [title, startTime] = key.split('|');
    duplicates.push({ title: title ?? '', start: startTime ?? '', count });
  }

  for (let index = 0; index < timed.length; index += 1) {
    for (let partner = index + 1; partner < timed.length; partner += 1) {
      const left = timed[index]!;
      const right = timed[partner]!;
      if (right.start >= left.end) break;
      const overlap = minutesBetween(
        right.start > left.start ? right.start : left.start,
        right.end < left.end ? right.end : left.end,
      );
      if (overlap <= 0) continue;
      const contained =
        (left.start <= right.start && right.end <= left.end) ||
        (right.start <= left.start && left.end <= right.end);
      overlaps.push({
        date: left.localDate,
        a: left.title,
        b: right.title,
        minutes: overlap,
        kind: contained ? 'contained' : 'partial',
      });
    }
  }

  const byDay = new Map<string, CalendarEvent[]>();
  for (const event of timed) {
    const dayEvents = byDay.get(event.localDate) ?? [];
    dayEvents.push(event);
    byDay.set(event.localDate, dayEvents);
  }
  const cursor = new Date(first);
  while (cursor <= last) {
    const date = cursor.toISOString().slice(0, 10);
    const dayEvents = (byDay.get(date) ?? []).sort(
      (left, right) => left.start.getTime() - right.start.getTime(),
    );
    const wakeOpen = new Date(`${date}T06:00:00.000Z`);
    const wakeClose = new Date(`${date}T22:00:00.000Z`);
    let point = wakeOpen;
    let coveredMinutes = 0;
    for (const event of dayEvents) {
      const eventStart = event.start > wakeOpen ? event.start : wakeOpen;
      const eventEnd = event.end < wakeClose ? event.end : wakeClose;
      if (eventEnd <= eventStart) continue;
      coveredMinutes += minutesBetween(eventStart, eventEnd);
      const gap = minutesBetween(point, eventStart);
      if (gap >= 45) {
        deadSpots.push({
          date,
          from: point.toISOString().slice(11, 16),
          to: eventStart.toISOString().slice(11, 16),
          minutes: gap,
        });
      } else if (gap >= 6 && gap <= 20 && point > wakeOpen) {
        slivers.push({
          date,
          from: point.toISOString().slice(11, 16),
          to: eventStart.toISOString().slice(11, 16),
          minutes: gap,
        });
      }
      if (eventEnd > point) point = eventEnd;
    }
    const tail = minutesBetween(point, wakeClose);
    if (tail >= 45) {
      deadSpots.push({
        date,
        from: point.toISOString().slice(11, 16),
        to: wakeClose.toISOString().slice(11, 16),
        minutes: tail,
      });
    }
    dayStats.push({
      date,
      eventCount: dayEvents.length,
      coveredMinutes,
      wakingMinutes: minutesBetween(wakeOpen, wakeClose),
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  for (const event of timed) {
    if (/^(Walk:|Train:|Flight:|Taxi:)/.test(event.title) && !event.location) {
      violations.push({
        date: event.localDate,
        rule: 'trip_leg_blank_location',
        detail: event.title,
      });
    }
    if (/^(Meal:|Lab)/.test(event.title) && !event.description) {
      violations.push({
        date: event.localDate,
        rule: 'empty_container_no_payload',
        detail: event.title,
      });
    }
    if (event.title.split(/\s+/).length > 4) {
      violations.push({ date: event.localDate, rule: 'title_over_4_words', detail: event.title });
    }
    if (/^Sleep\b/.test(event.title)) {
      const hours = minutesBetween(event.start, event.end) / 60;
      if (hours < 7 || hours > 9.5) {
        sleepAnomalies.push({ date: event.localDate, hours: Math.round(hours * 10) / 10 });
      }
    }
  }

  const uniqueViolations = new Map<string, (typeof violations)[number]>();
  for (const violation of violations) {
    uniqueViolations.set(`${violation.date}|${violation.rule}|${violation.detail}`, violation);
  }
  violations.splice(0, violations.length, ...uniqueViolations.values());

  return {
    ok: true,
    start,
    end,
    eventCount: timed.length,
    overlaps,
    duplicates,
    deadSpots,
    slivers,
    sleepAnomalies,
    violations,
    dayStats,
  };
}

function defaultRange(): { start: string; end: string } {
  const today = new Date();
  const candidate = new Date(Date.UTC(today.getUTCFullYear(), 0, 31));
  if (
    candidate < new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  ) {
    candidate.setUTCFullYear(candidate.getUTCFullYear() + 1);
  }
  return {
    start: today.toISOString().slice(0, 10),
    end: candidate.toISOString().slice(0, 10),
  };
}

function runDir(start: string, end: string): string {
  return join(
    process.env.HOMINEM_CALENDAR_DIR ?? join(homedir(), '.hominem', 'calendar'),
    'runs',
    `${start}_to_${end}`,
  );
}

function pullPrimary(start: string, end: string): unknown[] {
  const real = process.env.GWS_CLI;
  if (!real) throw new Error('GWS_CLI is not set — point it at the Google Workspace CLI binary');
  const argv = [
    'calendar',
    'list',
    '--start',
    `${start}T00:00:00Z`,
    '--end',
    `${end}T23:59:59Z`,
    '--calendar',
    'primary',
    '--max',
    '250',
  ];
  const request = new Date();
  const started = performance.now();
  const proc = spawnSync(real, argv, { encoding: 'utf-8', env: process.env });
  const ended = new Date();
  const stdout = proc.stdout ?? '';
  const stderr = proc.stderr ?? '';
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout) as unknown;
  } catch {
    parsed = stdout;
  }
  const ok = proc.status === 0 && Array.isArray(parsed);
  logEvent('gws', argv, {
    tsRequest: request.toISOString(),
    tsRequestMs: request.getTime(),
    tsResponse: ended.toISOString(),
    tsResponseMs: ended.getTime(),
    durationMs: Math.round(performance.now() - started),
    service: 'calendar',
    params: { start, end, calendar: 'primary', max: 250 },
    response: parsed,
    httpStatus: ok ? 200 : undefined,
    ok,
    isError: !ok,
    error: ok
      ? null
      : { error: 'cli_exit_nonzero', message: (stderr || stdout).trim().slice(0, 500) },
    exitCode: proc.status ?? undefined,
    stderr: stderr || undefined,
  });
  if (proc.status !== 0) {
    throw new Error((stderr || stdout).trim() || `calendar pull exited ${proc.status}`);
  }
  if (!Array.isArray(parsed)) throw new Error('calendar list returned a non-array event list');
  return parsed;
}

function markdown(report: CalendarReport): string {
  const lines = [
    `# Calendar analysis — ${report.start} to ${report.end}`,
    '',
    `Events: ${report.eventCount}`,
    `Overlaps: ${report.overlaps.length}`,
    `Duplicates: ${report.duplicates.length}`,
    `Dead spots: ${report.deadSpots.length}`,
    `Slivers: ${report.slivers.length}`,
    `Sleep anomalies: ${report.sleepAnomalies.length}`,
    `Violations: ${report.violations.length}`,
  ];
  for (const overlap of report.overlaps) {
    lines.push(
      `- overlap ${overlap.date}: ${overlap.a} x ${overlap.b} (${overlap.minutes}m ${overlap.kind})`,
    );
  }
  for (const spot of report.deadSpots) {
    lines.push(`- dead spot ${spot.date}: ${spot.from}–${spot.to} (${spot.minutes}m)`);
  }
  for (const violation of report.violations) {
    lines.push(`- ${violation.date} ${violation.rule}: ${violation.detail}`);
  }
  return `${lines.join('\n')}\n`;
}

export function humanCalendar(report: CalendarReport): string {
  const covered = report.dayStats.reduce((total, day) => total + day.coveredMinutes, 0);
  const waking = report.dayStats.reduce((total, day) => total + day.wakingMinutes, 0);
  const count =
    report.overlaps.length +
    report.duplicates.length +
    report.deadSpots.length +
    report.slivers.length +
    report.sleepAnomalies.length +
    report.violations.length;
  const lines = [
    `Calendar — ${report.start}${report.start === report.end ? '' : ` to ${report.end}`}`,
    `${report.eventCount} event${report.eventCount === 1 ? '' : 's'} · ${covered}/${waking} waking minutes`,
  ];
  if (count === 0) {
    lines.push('Quiet — no overlaps, duplicates, dead spots, slivers, or sleep anomalies.');
  } else {
    const findings = [
      ...report.overlaps.map(
        (finding) =>
          `${finding.date}: overlap — ${finding.a} x ${finding.b} (${finding.minutes}m ${finding.kind})`,
      ),
      ...report.duplicates.map(
        (finding) =>
          `${finding.start.slice(0, 10)}: duplicate — ${finding.title} (${finding.count}x)`,
      ),
      ...report.deadSpots.map(
        (finding) =>
          `${finding.date}: dead spot — ${finding.from}–${finding.to} (${finding.minutes}m)`,
      ),
      ...report.slivers.map(
        (finding) =>
          `${finding.date}: sliver — ${finding.from}–${finding.to} (${finding.minutes}m)`,
      ),
      ...report.sleepAnomalies.map(
        (finding) => `${finding.date}: sleep anomaly — ${finding.hours}h`,
      ),
      ...report.violations.map((finding) => `${finding.date}: ${finding.rule} — ${finding.detail}`),
    ];
    lines.push(`${count} flag${count === 1 ? '' : 's'}:`);
    for (const finding of findings.slice(0, 8)) lines.push(`- ${finding}`);
    if (findings.length > 8) lines.push(`- ${findings.length - 8} more — see the report`);
  }
  return `${lines.join('\n')}\n`;
}

export function calendarEnvelope(
  report: CalendarReport,
  source: 'live' | 'cache',
  runId: number,
  cache: string,
  reportJson: string,
  reportMarkdown: string,
): CalendarEnvelope {
  const covered = report.dayStats.reduce((total, day) => total + day.coveredMinutes, 0);
  const waking = report.dayStats.reduce((total, day) => total + day.wakingMinutes, 0);
  return {
    ok: true,
    start: report.start,
    end: report.end,
    event_count: report.eventCount,
    source,
    run_id: runId,
    summary: {
      overlaps: report.overlaps.length,
      duplicates: report.duplicates.length,
      dead_spots: report.deadSpots.length,
      slivers: report.slivers.length,
      sleep_anomalies: report.sleepAnomalies.length,
      violations: report.violations.length,
      covered_minutes: covered,
      waking_minutes: waking,
    },
    findings: {
      overlaps: report.overlaps,
      duplicates: report.duplicates,
      dead_spots: report.deadSpots,
      slivers: report.slivers,
      sleep_anomalies: report.sleepAnomalies,
      violations: report.violations,
    },
    artifacts: {
      cache,
      report_json: reportJson,
      report_markdown: reportMarkdown,
    },
  };
}

export async function main(args: string[]): Promise<number> {
  if (args.includes('--help') || args.includes('-h')) {
    if (args[0] === 'analyze') {
      process.stdout.write(
        'hominem calendar analyze\n\n' +
          'Read-only primary-calendar review.\n\n' +
          'Usage:\n' +
          '  hominem calendar analyze [--start YYYY-MM-DD] [--end YYYY-MM-DD] [--no-pull] [--json]\n\n' +
          'Options:\n' +
          '  --start YYYY-MM-DD  First local calendar date\n' +
          '  --end YYYY-MM-DD    Last local calendar date\n' +
          '  --no-pull           Reuse the cached event pull\n' +
          '  --json              Emit the machine-readable envelope\n' +
          '  --help, -h          Show this help\n',
      );
      return 0;
    }
  }
  if (args[0] !== 'analyze') {
    const choice = await select('Select a calendar action:', [
      { value: 'analyze', label: 'analyze — read the primary calendar' },
    ]);
    if (!choice) return 2;
  }
  const range = defaultRange();
  let start = range.start;
  let end = range.end;
  let noPull = false;
  let jsonOutput = false;
  let index = args[0] === 'analyze' ? 1 : 0;
  while (index < args.length) {
    const flag = args[index];
    if (flag === '--no-pull') {
      noPull = true;
      index += 1;
      continue;
    }
    if (flag === '--json') {
      jsonOutput = true;
      index += 1;
      continue;
    }
    if (flag === '--start') {
      start = args[index + 1] ?? start;
      index += 2;
      continue;
    }
    if (flag === '--end') {
      end = args[index + 1] ?? end;
      index += 2;
      continue;
    }
    process.stderr.write(`hominem calendar analyze: unknown argument ${flag}\n`);
    return 2;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    process.stderr.write('hominem calendar analyze: --start and --end must be YYYY-MM-DD\n');
    return 2;
  }
  if (new Date(`${start}T00:00:00Z`) > new Date(`${end}T23:59:59Z`)) {
    process.stderr.write('hominem calendar analyze: --start must be before --end\n');
    return 2;
  }

  const runId = logRun('calendar-analyze', {
    status: 'invoked',
    context: { start, end, noPull },
  });
  const dir = runDir(start, end);
  const cache = join(dir, 'events-cache.json');
  try {
    let raw: unknown[];
    if (noPull) {
      if (!existsSync(cache)) throw new Error(`calendar cache not found: ${cache}`);
      const parsed = JSON.parse(readFileSync(cache, 'utf8')) as unknown;
      if (!Array.isArray(parsed)) throw new Error(`calendar cache is not an array: ${cache}`);
      raw = parsed;
    } else {
      raw = pullPrimary(start, end);
      mkdirSync(dirname(cache), { recursive: true });
      writeFileSync(cache, JSON.stringify(raw, null, 2));
    }
    const report = analyzeEvents(normalizeEvents(raw), start, end);
    mkdirSync(dir, { recursive: true });
    const reportJson = join(dir, 'report.json');
    const reportMarkdown = join(dir, 'report.md');
    writeFileSync(reportJson, JSON.stringify(report, null, 2));
    writeFileSync(reportMarkdown, markdown(report));
    finishRun(runId, {
      status: 'completed',
      exitCode: 0,
      message: `${report.eventCount} events, ${report.overlaps.length} overlaps, ${report.violations.length} violations`,
    });
    if (jsonOutput) {
      process.stdout.write(
        `${JSON.stringify(
          calendarEnvelope(
            report,
            noPull ? 'cache' : 'live',
            runId,
            cache,
            reportJson,
            reportMarkdown,
          ),
          null,
          2,
        )}\n`,
      );
    } else {
      process.stdout.write(humanCalendar(report));
    }
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    finishRun(runId, { status: 'failed', exitCode: 1, message: message.slice(0, 500) });
    process.stderr.write(`hominem calendar analyze: ${message}\n`);
    return 1;
  }
}
