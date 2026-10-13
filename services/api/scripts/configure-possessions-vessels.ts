/**
 * Applies the weights tab's vessel configuration to Hominem for one owner.
 *
 *   pnpm --filter @hominem/api exec tsx scripts/configure-possessions-vessels.ts \
 *     --email you@ponti.io --config ~/Downloads/possessions-vessel-config.json [--apply]
 *
 * The config file is the frozen tab's formulas, as data — nothing owner-specific lives in
 * code. It writes:
 *   - per-vessel container fields: tareKg, limitKg, vesselGroup, vesselTokens;
 *   - the owner's weight-report config: marker tokens + group allowances;
 *   - any containers the config declares (e.g. a dangling reference's crate);
 *   - item→container links the config declares.
 *
 * Dry run by default; `--apply` writes. Idempotent: re-running with the same config makes
 * no further change.
 */

import { readFileSync } from 'node:fs';

import { db } from '@hominem/db/core';
import {
  ContainerRepository,
  PossessionRepository,
  VesselConfigRepository,
} from '@hominem/db/possessions';
import { runInTransaction } from '@hominem/db/transaction';

interface VesselDefinition {
  externalId: string;
  group?: string | null;
  tareKg?: number | null;
  limitKg?: number | null;
  tokens?: string[];
}

interface ConfigFile {
  markers: string[];
  groupAllowances: Record<string, number>;
  vessels: VesselDefinition[];
  createContainers?: Array<{ externalId: string; name: string; containerKind?: string }>;
  linkItems?: Array<{ externalId: string; containerExternalId: string | null }>;
}

function die(message: string): never {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

function arg(name: string): string | undefined {
  const at = process.argv.indexOf(`--${name}`);
  return at === -1 ? undefined : process.argv[at + 1];
}

async function main() {
  const email = arg('email');
  const configPath = arg('config')?.replace(/^~/, process.env.HOME ?? '~');
  const apply = process.argv.includes('--apply');
  if (!email || !configPath) {
    die('Usage: configure-possessions-vessels.ts --email <email> --config <file> [--apply]');
  }
  const config: ConfigFile = JSON.parse(readFileSync(configPath, 'utf8'));

  const user = await db
    .selectFrom('user')
    .select(['id', 'email'])
    .where('email', '=', email)
    .executeTakeFirst();
  if (!user) die(`No user with email ${email}`);

  const containers = await ContainerRepository.list(db, user.id);
  const byExternal = new Map(containers.map((c) => [c.externalId, c]));
  const willCreate = new Set((config.createContainers ?? []).map((c) => c.externalId));
  const missingVessels = config.vessels.filter(
    (v) => !byExternal.has(v.externalId) && !willCreate.has(v.externalId),
  );

  console.log(`User: ${user.email}`);
  console.log(`Markers: ${config.markers.join(', ')}`);
  console.log(`Group allowances: ${JSON.stringify(config.groupAllowances)}`);
  console.log(`Vessels to configure: ${config.vessels.length}`);
  for (const v of config.vessels) {
    const status = byExternal.has(v.externalId)
      ? ''
      : willCreate.has(v.externalId)
        ? '  (will create)'
        : '  ⚠ NOT FOUND';
    console.log(
      `  ${v.externalId} tare=${v.tareKg ?? '—'} limit=${v.limitKg ?? '—'} group=${v.group ?? '—'} tokens=[${(v.tokens ?? []).join(', ')}]${status}`,
    );
  }
  if (config.createContainers?.length) {
    console.log(
      `Containers to create: ${config.createContainers.map((c) => `${c.externalId} (${c.name})`).join(', ')}`,
    );
  }
  if (config.linkItems?.length) {
    console.log(
      `Items to link: ${config.linkItems.map((l) => `${l.externalId}->${l.containerExternalId ?? 'null'}`).join(', ')}`,
    );
  }
  if (missingVessels.length)
    die(`Vessel containers missing: ${missingVessels.map((v) => v.externalId).join(', ')}`);

  if (!apply) {
    console.log('\nDry run only. Re-run with --apply to write.');
    return;
  }

  await runInTransaction(async (trx) => {
    for (const create of config.createContainers ?? []) {
      const saved = await ContainerRepository.upsertByExternalId(trx, user.id, {
        externalId: create.externalId,
        name: create.name,
        containerKind: create.containerKind ?? 'durable_possession',
      });
      byExternal.set(create.externalId, saved.record);
    }

    for (const vessel of config.vessels) {
      const container = byExternal.get(vessel.externalId)!;
      await ContainerRepository.update(trx, user.id, container.id, {
        ...(vessel.tareKg !== undefined ? { tareKg: vessel.tareKg } : {}),
        ...(vessel.limitKg !== undefined ? { limitKg: vessel.limitKg } : {}),
        ...(vessel.group !== undefined ? { vesselGroup: vessel.group } : {}),
        ...(vessel.tokens !== undefined ? { vesselTokens: vessel.tokens } : {}),
      });
    }

    for (const link of config.linkItems ?? []) {
      const possession = await PossessionRepository.getByExternalId(trx, user.id, link.externalId);
      if (!possession) die(`No possession with externalId ${link.externalId}`);
      const containerId = link.containerExternalId
        ? (byExternal.get(link.containerExternalId)?.id ?? null)
        : null;
      await PossessionRepository.update(trx, user.id, possession.id, { containerId });
    }

    await VesselConfigRepository.set(trx, user.id, {
      markerTokens: config.markers,
      groupAllowances: config.groupAllowances,
    });
  });
  console.log('\n✓ Vessel configuration applied.');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
