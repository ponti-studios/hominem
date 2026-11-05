import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import type { EvaluationJournal, EvaluationRun } from '../types.js';
import { evaluationRunSchema } from '../types.js';
import type { StudioAction, StudioPreference, StudioResult } from './contract.js';

type Row = Record<string, unknown>;

export class StudioStore {
  private readonly db: DatabaseSync;
  readonly journal: EvaluationJournal;

  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS runs (
        trigger_id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS studio_runs (
        event_id TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS preferences (
        goal_id TEXT PRIMARY KEY,
        mode TEXT NOT NULL,
        until TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS actions (
        id TEXT PRIMARY KEY,
        goal_id TEXT NOT NULL,
        event_id TEXT NOT NULL,
        title TEXT NOT NULL,
        next_step TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);

    this.journal = {
      find: (ownerId, triggerId) => Promise.resolve(this.findRun(ownerId, triggerId)),
      commit: (run) => Promise.resolve(this.commitRun(run)),
    };
  }

  findRun(ownerId: string, triggerId: string): EvaluationRun | null {
    const row: Row | undefined = this.db
      .prepare('SELECT payload FROM runs WHERE owner_id = ? AND trigger_id = ?')
      .get(ownerId, triggerId);
    return row ? parseRun(row.payload) : null;
  }

  commitRun(input: EvaluationRun): EvaluationRun {
    const run = evaluationRunSchema.parse(input);
    this.db
      .prepare(
        `INSERT OR IGNORE INTO runs (trigger_id, owner_id, payload, created_at)
         VALUES (?, ?, ?, ?)`,
      )
      .run(run.triggerId, run.ownerId, JSON.stringify(run), run.processedAt);
    const stored = this.findRun(run.ownerId, run.triggerId);
    if (!stored) throw new Error('Failed to persist the evaluation run.');
    return stored;
  }

  deleteRun(triggerId: string): void {
    this.db.prepare('DELETE FROM runs WHERE trigger_id = ?').run(triggerId);
  }

  getStudioRun(eventId: string): StudioResult[] | null {
    const row: Row | undefined = this.db
      .prepare('SELECT payload FROM studio_runs WHERE event_id = ?')
      .get(eventId);
    if (!row) return null;
    const results: StudioResult[] = JSON.parse(String(row.payload));
    return results;
  }

  deleteStudioRun(eventId: string): void {
    this.db.prepare('DELETE FROM studio_runs WHERE event_id = ?').run(eventId);
  }

  putStudioRun(eventId: string, results: StudioResult[]): void {
    this.db
      .prepare(
        `INSERT INTO studio_runs (event_id, payload, created_at)
         VALUES (?, ?, ?)
         ON CONFLICT(event_id) DO UPDATE SET payload = excluded.payload, created_at = excluded.created_at`,
      )
      .run(eventId, JSON.stringify(results), new Date().toISOString());
  }

  listStudioRuns(): Map<string, StudioResult[]> {
    const rows: Row[] = this.db.prepare('SELECT event_id, payload FROM studio_runs').all();
    const entries: Array<[string, StudioResult[]]> = rows.map((row) => {
      const results: StudioResult[] = JSON.parse(String(row.payload));
      return [String(row.event_id), results];
    });
    return new Map(entries);
  }

  setPreference(
    goalId: string,
    mode: StudioPreference['mode'],
    until: string,
    updatedAt: string,
  ): void {
    this.db
      .prepare(
        `INSERT INTO preferences (goal_id, mode, until, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(goal_id) DO UPDATE SET mode = excluded.mode, until = excluded.until,
           updated_at = excluded.updated_at`,
      )
      .run(goalId, mode, until, updatedAt);
  }

  clearPreference(goalId: string): void {
    this.db.prepare('DELETE FROM preferences WHERE goal_id = ?').run(goalId);
  }

  listPreferences(now: string): StudioPreference[] {
    const rows: Row[] = this.db
      .prepare('SELECT goal_id, mode, until FROM preferences WHERE until > ?')
      .all(now);
    return rows.map((row) => ({
      goalId: String(row.goal_id),
      mode: row.mode === 'mute' ? 'mute' : 'snooze',
      until: String(row.until),
    }));
  }

  activePreference(goalId: string, now: string): StudioPreference | null {
    const row: Row | undefined = this.db
      .prepare('SELECT goal_id, mode, until FROM preferences WHERE goal_id = ? AND until > ?')
      .get(goalId, now);
    if (!row) return null;
    return {
      goalId: String(row.goal_id),
      mode: row.mode === 'mute' ? 'mute' : 'snooze',
      until: String(row.until),
    };
  }

  addAction(input: Omit<StudioAction, 'id' | 'status'>): StudioAction {
    const action: StudioAction = {
      ...input,
      id: `act-${randomUUID()}`,
      status: 'open',
    };
    this.db
      .prepare(
        `INSERT INTO actions (id, goal_id, event_id, title, next_step, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        action.id,
        action.goalId,
        action.eventId,
        action.title,
        action.nextStep,
        action.status,
        action.createdAt,
      );
    return action;
  }

  listActions(): StudioAction[] {
    const rows: Row[] = this.db.prepare('SELECT * FROM actions ORDER BY created_at DESC').all();
    return rows.map(toAction);
  }

  setActionStatus(id: string, status: StudioAction['status']): void {
    this.db.prepare('UPDATE actions SET status = ? WHERE id = ?').run(status, id);
  }

  reset(): void {
    this.db.exec(
      'DELETE FROM runs; DELETE FROM studio_runs; DELETE FROM preferences; DELETE FROM actions;',
    );
  }

  close(): void {
    this.db.close();
  }
}

function parseRun(payload: unknown): EvaluationRun {
  const parsed: unknown = JSON.parse(String(payload));
  return evaluationRunSchema.parse(parsed);
}

function toAction(row: Row): StudioAction {
  return {
    id: String(row.id),
    goalId: String(row.goal_id),
    eventId: String(row.event_id),
    title: String(row.title),
    nextStep: String(row.next_step),
    status: row.status === 'done' ? 'done' : 'open',
    createdAt: String(row.created_at),
  };
}
