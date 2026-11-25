#!/usr/bin/env node
/**
 * Wealth seed — the one-time (and re-runnable, law 3) provisioning of
 * Hominem's routing registry and ingest doctrine, the two things the
 * sync resolves at runtime. The 2026-11-22 ruling keeps this repo free
 * of personal financial data, so the seed carries no rules and no
 * account identities of its own:
 *
 *   - Account identities come from the bank: the Starling accounts
 *     backbone (one GET), each row created in Hominem via
 *     finance_account_create with (provider "starling",
 *     providerAccountId = the bank-side UID) — the identity the sync
 *     routes by. Idempotent: an existing account comes back
 *     created:false, never a duplicate.
 *   - The doctrine comes from a machine-local file named by
 *     WEALTH_SEED_DOCTRINE and is imported wholesale via
 *     finance_doctrine_import (full replace, fingerprint computed
 *     server-side, identical contents are a no-op). The file lives
 *     outside the repo — it is Charles's ingest rules, not code.
 *     Unset skips the doctrine leg with a named note; set-but-
 *     unreadable fails loudly before any external call.
 *
 * The prod seed is this same command: the doctrine file and the token
 * are the only things that change, both machine-local.
 *
 * A failed create fails the whole run — a half-seeded registry must
 * never present itself as done. Re-run after fixing; every step is
 * idempotent.
 *
 * Env (law 4 — a missing variable fails by name):
 *   STARLING_API_TOKEN    Starling bearer token
 *   HOMINEM_MCP_URL       e.g. https://finance-sync-doctrine.api.lvh.me/api/mcp
 *   HOMINEM_MCP_TOKEN     personal hmt_ token
 *   WEALTH_SEED_DOCTRINE  optional path to the doctrine JSON file
 *
 * Prints JSON: {ok, doctrine, doctrine_note?, accounts, run_id}
 */
import { readFileSync } from 'node:fs';

import { finishRun, logRun } from '../../log/agent_log.ts';
import { applyEnvDefaults } from './env.ts';
import { HominemMcp, type AccountCreateResult, type DoctrineImportResult } from './hominem.ts';
import { starlingAccounts } from './starling.ts';
import type { SyncDoctrine } from './types.ts';

/**
 * Starling accountType -> Hominem accountType. Deliberately narrow:
 * the type feeds finance_runway's liquid set (cash/checking/savings),
 * and anything unrecognized stays a plain checking account rather
 * than a guess.
 */
function mapAccountType(starlingType: string): string {
  const t = starlingType.toUpperCase();
  if (t.includes('SAVING') || t.includes('GOAL')) return 'savings';
  return 'checking';
}

interface SeedAccount {
  name: string;
  provider_account_id: string;
  created: boolean;
  id: string | null;
}

interface SeedEnvelope {
  ok: boolean;
  /** Null when WEALTH_SEED_DOCTRINE was unset (the note names it). */
  doctrine: {
    status: DoctrineImportResult['status'];
    fingerprint: string;
    ruleCounts: DoctrineImportResult['ruleCounts'];
  } | null;
  doctrine_note?: string;
  accounts: SeedAccount[];
  run_id: number;
}

export async function main(): Promise<number> {
  applyEnvDefaults();
  const dbPath = process.env.HOMINEM_AGENT_DB; // undefined = the default audit db
  const runId = logRun('wealth-seed', {
    status: 'invoked',
    context: { doctrineFile: process.env.WEALTH_SEED_DOCTRINE ?? null },
    path: dbPath,
  });
  try {
    const hominem = new HominemMcp({ dbPath });

    // Doctrine leg — machine-local file, wholesale import, idempotent.
    let doctrine: SeedEnvelope['doctrine'] = null;
    let doctrineNote: string | undefined;
    const doctrinePath = process.env.WEALTH_SEED_DOCTRINE;
    if (!doctrinePath) {
      doctrineNote =
        'no WEALTH_SEED_DOCTRINE set — merchants land Uncategorized and queue for a ruling; ' +
        'import one with finance_doctrine_import (or re-run with WEALTH_SEED_DOCTRINE pointing at the file)';
    } else {
      let raw: string;
      try {
        raw = readFileSync(doctrinePath, 'utf8');
      } catch (err) {
        throw new Error(
          `WEALTH_SEED_DOCTRINE points at an unreadable file (${doctrinePath}): ${(err as Error).message}`,
        );
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch (err) {
        throw new Error(
          `WEALTH_SEED_DOCTRINE file is not valid JSON (${doctrinePath}): ${(err as Error).message}`,
        );
      }
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error(
          `WEALTH_SEED_DOCTRINE file must hold one doctrine object (${doctrinePath}), got ` +
            `${Array.isArray(parsed) ? 'an array' : typeof parsed}`,
        );
      }
      const res = await hominem.importFinanceDoctrine(parsed as SyncDoctrine);
      doctrine = {
        status: res.status,
        fingerprint: res.fingerprint,
        ruleCounts: res.ruleCounts,
      };
    }

    // Accounts leg — the bank is the source of identity, never a file.
    const bankAccounts = await starlingAccounts({ dbPath });
    if (bankAccounts.length === 0) {
      throw new Error('starling /api/v2/accounts returned no accounts — nothing to seed');
    }
    const accounts: SeedAccount[] = [];
    for (const a of bankAccounts) {
      const res: AccountCreateResult = await hominem.createFinanceAccount({
        name: a.name,
        currencyCode: a.currency,
        provider: 'starling',
        providerAccountId: a.accountUid,
        accountType: mapAccountType(a.accountType),
      });
      if (res.id === null) {
        throw new Error(
          `finance_account_create returned no id for ${a.name} (${a.accountUid}) — a null id means the write did not land`,
        );
      }
      accounts.push({
        name: res.name,
        provider_account_id: res.providerAccountId ?? a.accountUid,
        created: res.created,
        id: res.id,
      });
    }

    const created = accounts.filter((a) => a.created).length;
    finishRun(runId, {
      status: 'ok',
      exitCode: 0,
      message: `doctrine ${doctrine ? doctrine.status : 'skipped'}, ${created} created, ${accounts.length - created} existing`,
      path: dbPath,
    });
    const envelope: SeedEnvelope = {
      ok: true,
      doctrine,
      accounts,
      run_id: runId,
    };
    if (doctrineNote) envelope.doctrine_note = doctrineNote;
    process.stdout.write(JSON.stringify(envelope, null, 1) + '\n');
    return 0;
  } catch (err) {
    const message = `${(err as Error).name ?? 'Error'}: ${(err as Error).message ?? String(err)}`;
    finishRun(runId, {
      status: 'failed',
      exitCode: 1,
      message: message.slice(0, 500),
      path: dbPath,
    });
    process.stdout.write(JSON.stringify({ ok: false, error: message }, null, 1) + '\n');
    return 1;
  }
}
