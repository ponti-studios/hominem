import { createHash } from 'node:crypto';

import { db, runInTransaction, sql } from '@hominem/db/core';
import { FinanceRulingRepository } from '@hominem/db/finance';
import {
  clusterRulingTransactions,
  normalizeRulingMerchant,
  proposeRuling,
  type RulingTransaction,
} from '@hominem/finance-services/rulings';
import { z } from 'zod';

import { ValidationError } from '../errors';
import {
  rulingRowSchema,
  rulingRulebookImportInputSchema,
  rulingRulebookSchema,
  rulingSnapshotSchema,
  rulingVerdictInputSchema,
} from '../schemas/finance.rulings.schema';
import { searchTransactions } from './finance.service';

async function readTransactions(userId: string, uncategorizedOnly = false) {
  const rows: RulingTransaction[] = [];
  const seen = new Set<string>();
  let cursor: string | undefined;
  let expectedCount: number | undefined;
  do {
    const page = await searchTransactions(userId, {
      ...(uncategorizedOnly ? { uncategorizedOnly: true } : {}),
      limit: 50,
      ...(cursor ? { cursor } : {}),
    });
    expectedCount ??= page.filteredCount;
    if (page.filteredCount !== expectedCount) {
      throw new ValidationError('Transactions changed during preparation. Please try again.');
    }
    for (const row of page.data) {
      if (seen.has(row.id))
        throw new ValidationError('Transaction paging changed. Please try again.');
      seen.add(row.id);
      rows.push({
        id: row.id,
        externalId: row.externalId,
        description: row.description ?? row.merchantName ?? '',
        postedOn: row.postedOn,
        amountCents: Math.round(row.amount * 100),
        currencyCode: row.currencyCode,
        excluded: row.excluded,
        before: {
          accountId: row.accountId,
          accountName: row.accountName,
          categoryId: row.categoryId,
          categoryName: row.categoryName,
          tags: row.tags,
          source: row.source,
          pending: row.pending,
        },
      });
    }
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  if (rows.length !== expectedCount) {
    throw new ValidationError('Transactions changed during preparation. Please try again.');
  }
  return rows;
}

async function listRulingVerdicts(userId: string) {
  const [verdicts, events] = await Promise.all([
    FinanceRulingRepository.listVerdicts(db, userId),
    FinanceRulingRepository.listEvents(db, userId),
  ]);
  return verdicts.map((verdict) => ({
    id: verdict.id,
    preparationId: verdict.preparationId,
    clusterId: verdict.clusterId,
    verdict: verdict.verdict,
    createdAt: verdict.createdAt,
    rowIds: z
      .array(rulingRowSchema)
      .parse(verdict.rows)
      .map((row) => row.id),
    status: rulingStatus(events.filter((event) => event.verdictId === verdict.id)),
  }));
}

function rulingStatus(events: Array<{ eventType: string }>) {
  let status: 'queued' | 'filing' | 'filed' | 'failed' = 'queued';
  for (const event of events) {
    if (event.eventType === 'filing' || event.eventType === 'row_applied') status = 'filing';
    if (event.eventType === 'filed') status = 'filed';
    if (event.eventType === 'failed') status = 'failed';
  }
  return status;
}

async function learnMerchantRule(
  handle: Parameters<typeof FinanceRulingRepository.latestRulebook>[0],
  userId: string,
  merchant: string,
  category: string,
  tags: string[],
) {
  const [latest, options] = await Promise.all([
    FinanceRulingRepository.latestRulebook(handle, userId),
    FinanceRulingRepository.listOptions(handle, userId),
  ]);
  const rulebook = latest
    ? rulingRulebookSchema.parse(latest.contents)
    : {
        categories: [],
        tags: [],
        merchantRules: [],
        categoryRules: [],
        tagRules: [],
        coffeePatterns: [],
      };
  const key = normalizeRulingMerchant(merchant);
  const contents = {
    ...rulebook,
    categories: [
      ...new Set([...rulebook.categories, ...options.categories.map(({ name }) => name)]),
    ],
    tags: [...new Set([...rulebook.tags, ...options.tags.map(({ name }) => name)])],
    merchantRules: [
      ...rulebook.merchantRules.filter((rule) => normalizeRulingMerchant(rule.merchant) !== key),
      { merchant, category, tags },
    ],
  };
  const fingerprint = createHash('sha256').update(JSON.stringify(contents)).digest('hex');
  await FinanceRulingRepository.saveLiveRulebook(handle, userId, fingerprint, contents);
}

/** Export only the caller's recorded verdicts, with their frozen review state. */
export async function listRulingQueue(userId: string, offset: number, limit: number) {
  const [verdicts, events] = await Promise.all([
    FinanceRulingRepository.listVerdicts(db, userId),
    FinanceRulingRepository.listEvents(db, userId),
  ]);
  return {
    total: verdicts.length,
    verdicts: verdicts.slice(offset, offset + limit).map((verdict) => ({
      id: verdict.id,
      preparationId: verdict.preparationId,
      clusterId: verdict.clusterId,
      merchant: verdict.merchant,
      verdict: z.enum(['kill', 'file', 'change']).parse(verdict.verdict),
      category: verdict.category,
      tags: z.array(z.string()).parse(verdict.tags),
      rows: z.array(rulingRowSchema).parse(verdict.rows),
      createdAt: verdict.createdAt,
      status: rulingStatus(events.filter((event) => event.verdictId === verdict.id)),
      events: events
        .filter((event) => event.verdictId === verdict.id)
        .map(({ eventType, details, createdAt }) => ({ eventType, details, createdAt })),
    })),
  };
}

/** Prepare an owner-scoped snapshot without changing any ledger transaction. */
export async function prepareRulings(userId: string) {
  const storedRulebook = await FinanceRulingRepository.latestRulebook(db, userId);
  const rulebook = storedRulebook ? rulingRulebookSchema.parse(storedRulebook.contents) : null;
  const clusters = clusterRulingTransactions(await readTransactions(userId, true));
  const [history, options] = await Promise.all([
    readTransactions(userId),
    FinanceRulingRepository.listOptions(db, userId),
  ]);
  for (const cluster of clusters) {
    const suggestion = proposeRuling(cluster, rulebook, history);
    cluster.proposal =
      suggestion &&
      options.categories.some((item) => item.name === suggestion.category) &&
      suggestion.tags.every((tag) => options.tags.some((item) => item.name === tag))
        ? suggestion
        : null;
  }
  const snapshot = { clusters, rulebook };
  const preparationId = await FinanceRulingRepository.createPreparation(db, userId, snapshot);
  const verdicts = await listRulingVerdicts(userId);
  return { preparationId, ...snapshot, ...options, verdicts };
}

export async function getLatestRulings(userId: string) {
  const preparation = await FinanceRulingRepository.latestPreparation(db, userId);
  if (!preparation) return null;
  const snapshot = rulingSnapshotSchema.parse(preparation.snapshot);
  const [options, storedRulebook, verdicts] = await Promise.all([
    FinanceRulingRepository.listOptions(db, userId),
    FinanceRulingRepository.latestRulebook(db, userId),
    listRulingVerdicts(userId),
  ]);
  return {
    preparationId: preparation.id,
    ...snapshot,
    ...options,
    rulebook: storedRulebook
      ? rulingRulebookSchema.parse(storedRulebook.contents)
      : (snapshot.rulebook ?? null),
    verdicts,
  };
}

/** Save a caller-owned reference taxonomy for future review preparations. */
export async function importReferenceRulebook(userId: string, input: unknown) {
  const parsed = rulingRulebookImportInputSchema.parse(input);
  const id = await FinanceRulingRepository.saveReferenceRulebook(
    db,
    userId,
    parsed.fingerprint,
    parsed.rulebook,
  );
  return { id, fingerprint: parsed.fingerprint };
}

/** Apply one frozen row and record its before/after state in the same transaction.
 * This is intentionally not exposed to a worker until filing authority is enabled. */
export async function applyRulingRow(userId: string, verdictId: string, rowId: string) {
  return runInTransaction(async (trx) => {
    const verdict = await FinanceRulingRepository.lockVerdict(trx, userId, verdictId);
    if (!verdict) throw new ValidationError('Verdict not found.');
    const rows = z.array(rulingRowSchema).parse(verdict.rows);
    const matchingRows = rows.filter((row) => row.id === rowId);
    const expected = matchingRows[0];
    if (
      matchingRows.length !== 1 ||
      !expected ||
      !expected.before ||
      !expected.externalId ||
      !expected.before.source
    )
      throw new ValidationError('The transaction is not a complete reviewed row.');
    const action = z.enum(['file', 'change', 'kill']).parse(verdict.verdict);
    const tags = z.array(z.string()).parse(verdict.tags);
    if (action !== 'kill' && !verdict.category)
      throw new ValidationError('The verdict does not contain a category.');
    const events = await FinanceRulingRepository.listEvents(trx, userId);
    if (
      events.some(
        (event) =>
          event.verdictId === verdictId &&
          event.eventType === 'row_applied' &&
          z.object({ rowId: z.string() }).safeParse(event.details).data?.rowId === rowId,
      )
    ) {
      return { status: 'already_applied' as const };
    }
    const before = await FinanceRulingRepository.lockTransaction(trx, userId, rowId);
    const beforeTags = before
      ? await FinanceRulingRepository.transactionTags(trx, userId, rowId)
      : [];
    const equalTags = (left: string[], right: string[]) =>
      JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
    if (
      !before ||
      before.excluded ||
      before.externalId !== expected.externalId ||
      before.accountId !== expected.before.accountId ||
      before.source !== expected.before.source ||
      before.pending !== expected.before.pending ||
      before.pending ||
      before.categoryId !== expected.before.categoryId ||
      Math.round(before.amount * 100) !== expected.amountCents ||
      before.currencyCode !== expected.currencyCode ||
      before.postedOn !== expected.postedOn ||
      (before.description ?? before.merchantName ?? '') !== expected.description ||
      !equalTags(
        beforeTags.map((tag) => tag.name),
        expected.before.tags,
      )
    ) {
      await FinanceRulingRepository.appendEvent(trx, userId, verdictId, 'failed', {
        rowId,
        reason: 'conflict',
      });
      return { status: 'conflict' as const };
    }
    let expectedCategoryId = before.categoryId;
    if (action === 'kill') await FinanceRulingRepository.excludeTransaction(trx, userId, rowId);
    else
      expectedCategoryId = await FinanceRulingRepository.applyClassification(
        trx,
        userId,
        rowId,
        verdict.category!,
        tags,
      );
    const after = await FinanceRulingRepository.lockTransaction(trx, userId, rowId);
    const afterTags = await FinanceRulingRepository.transactionTags(trx, userId, rowId);
    const expectedAfter = {
      ...before,
      categoryId: expectedCategoryId,
      excluded: action === 'kill',
    };
    const expectedTags = action === 'kill' ? beforeTags.map((tag) => tag.name) : tags;
    if (
      !after ||
      JSON.stringify(after) !== JSON.stringify(expectedAfter) ||
      !equalTags(
        afterTags.map((tag) => tag.name.toLowerCase()),
        expectedTags.map((tag) => tag.toLowerCase()),
      )
    ) {
      throw new ValidationError('The transaction did not match the approved result.');
    }
    await FinanceRulingRepository.appendEvent(trx, userId, verdictId, 'row_applied', {
      rowId,
      before: { ...before, tags: beforeTags.map((tag) => tag.name) },
      after: { ...after, tags: afterTags.map((tag) => tag.name) },
    });
    return { status: 'applied' as const };
  });
}

/** Queue an exact, explicitly reviewed verdict. This never changes the ledger. */
export async function queueRulingVerdict(
  userId: string,
  input: z.infer<typeof rulingVerdictInputSchema>,
) {
  const { preparationId, clusterId, rowIds } = input;
  return runInTransaction(async (trx) => {
    await sql`select pg_advisory_xact_lock(hashtextextended(${`finance-rulings:${userId}`}, 0))`.execute(
      trx,
    );
    const preparation = await FinanceRulingRepository.findPreparation(trx, userId, preparationId);
    if (!preparation)
      throw new ValidationError('Preparation not found. Prepare transactions again.');
    const snapshot = rulingSnapshotSchema.parse(preparation.snapshot);
    const cluster = snapshot.clusters.find((item) => item.id === clusterId);
    if (!cluster || cluster.rows.length === 0)
      throw new ValidationError('Cluster not found. Prepare transactions again.');
    const selectedRows = cluster.rows.filter((row) => rowIds.includes(row.id));
    if (selectedRows.length !== rowIds.length)
      throw new ValidationError('A selected transaction is not in this prepared cluster.');
    const ruling =
      input.verdict === 'kill' ? null : input.verdict === 'file' ? cluster.proposal : input;
    if (input.verdict !== 'kill') {
      if (!ruling)
        throw new ValidationError('No rulebook or transaction history suggests a category.');
      const options = await FinanceRulingRepository.listOptions(trx, userId);
      if (!options.categories.some((category) => category.name === ruling.category))
        throw new ValidationError('Choose an existing Finance category.');
      if (
        new Set(ruling.tags).size !== ruling.tags.length ||
        ruling.tags.some((tag) => !options.tags.some((option) => option.name === tag))
      )
        throw new ValidationError('Choose existing Finance tags.');
    }
    if (selectedRows.some((row) => !row.externalId || !row.before?.source || row.before.pending)) {
      throw new ValidationError(
        'Every transaction needs a posted source and external ID before it can be ruled.',
      );
    }
    const identities = new Set(
      selectedRows.map((row) => `${row.before?.source}:${row.externalId}`),
    );
    if (identities.size !== selectedRows.length) {
      throw new ValidationError('Transactions in this cluster have duplicate external identities.');
    }
    const previous = await FinanceRulingRepository.listVerdicts(trx, userId);
    const existing = previous.find(
      (verdict) =>
        verdict.preparationId === preparationId &&
        verdict.clusterId === clusterId &&
        JSON.stringify(
          z
            .array(rulingRowSchema)
            .parse(verdict.rows)
            .map((row) => row.id)
            .sort(),
        ) === JSON.stringify([...rowIds].sort()),
    );
    if (
      existing &&
      existing.verdict === input.verdict &&
      existing.category === (ruling?.category ?? null) &&
      JSON.stringify(z.array(z.string()).parse(existing.tags).sort()) ===
        JSON.stringify([...(ruling?.tags ?? [])].sort())
    )
      return { id: existing.id, status: 'queued' as const };
    const ruled = new Set(
      previous.flatMap((verdict) =>
        z
          .array(rulingRowSchema)
          .parse(verdict.rows)
          .map((row) => row.id),
      ),
    );
    if (selectedRows.some((row) => ruled.has(row.id))) {
      throw new ValidationError('A selected transaction already has a verdict.');
    }
    const current = new Map((await readTransactions(userId, true)).map((row) => [row.id, row]));
    for (const row of selectedRows) {
      const now = current.get(row.id);
      if (
        !now ||
        now.excluded ||
        now.externalId !== row.externalId ||
        now.amountCents !== row.amountCents ||
        now.currencyCode !== row.currencyCode ||
        now.postedOn !== row.postedOn ||
        now.description !== row.description ||
        now.before?.accountId !== row.before?.accountId ||
        now.before?.categoryId !== row.before?.categoryId ||
        now.before?.source !== row.before?.source ||
        now.before?.pending !== row.before?.pending ||
        JSON.stringify([...(now.before?.tags ?? [])].sort()) !==
          JSON.stringify([...(row.before?.tags ?? [])].sort())
      ) {
        throw new ValidationError(
          'A transaction changed since preparation. Prepare again before ruling.',
        );
      }
    }
    if (input.verdict === 'change' && ruling)
      await learnMerchantRule(trx, userId, cluster.merchant, ruling.category, ruling.tags);
    const id = await FinanceRulingRepository.createVerdict(trx, userId, {
      preparationId,
      clusterId,
      merchant: cluster.merchant,
      verdict: input.verdict,
      category: ruling?.category ?? null,
      tags: ruling?.tags ?? [],
      rows: selectedRows,
    });
    return { id, status: 'queued' as const };
  });
}
