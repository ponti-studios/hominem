import { randomUUID } from 'node:crypto';

import { afterEach, describe, expect, it } from 'vitest';

import { authDb, db } from '../../db';
import { FinanceRulingRepository } from './ruling.repository';

describe('FinanceRulingRepository', () => {
  const users: string[] = [];

  afterEach(async () => {
    for (const id of users.splice(0))
      await authDb.deleteFrom('user').where('id', '=', id).execute();
  });

  it('keeps preparations and verdicts owner-scoped and records the initial event', async () => {
    const owner = randomUUID();
    const other = randomUUID();
    users.push(owner, other);
    for (const id of users) {
      await authDb
        .insertInto('user')
        .values({ id, name: 'Rulings test', email: `${id}@example.com` })
        .execute();
    }
    await FinanceRulingRepository.saveReferenceRulebook(db, owner, 'reference-v1', {
      categories: ['Food'],
      tags: ['Coffee'],
    });
    expect(await FinanceRulingRepository.latestRulebook(db, owner)).toMatchObject({
      fingerprint: 'reference-v1',
      contents: { categories: ['Food'], tags: ['Coffee'] },
    });
    expect(await FinanceRulingRepository.latestRulebook(db, other)).toBeNull();
    await FinanceRulingRepository.saveLiveRulebook(db, owner, 'live-v1', {
      categories: ['Food'],
      tags: ['Coffee'],
      merchantRules: [{ merchant: 'Coffee House', category: 'Food', tags: ['Coffee'] }],
      categoryRules: [],
      tagRules: [],
      coffeePatterns: [],
    });
    expect(await FinanceRulingRepository.latestRulebook(db, owner)).toMatchObject({
      fingerprint: 'live-v1',
      contents: { merchantRules: [{ merchant: 'Coffee House' }] },
    });
    const preparationId = await FinanceRulingRepository.createPreparation(db, owner, {
      clusters: [],
    });
    expect(await FinanceRulingRepository.findPreparation(db, other, preparationId)).toBeNull();
    expect(await FinanceRulingRepository.latestPreparation(db, owner)).toMatchObject({
      id: preparationId,
    });

    const verdictId = await db.transaction().execute((trx) =>
      FinanceRulingRepository.createVerdict(trx, owner, {
        preparationId,
        clusterId: 'cluster-1',
        merchant: 'sample',
        verdict: 'kill',
        rows: [{ id: 'row-1' }],
      }),
    );
    expect(await FinanceRulingRepository.listVerdicts(db, other)).toEqual([]);
    expect(await FinanceRulingRepository.listVerdicts(db, owner)).toMatchObject([
      { id: verdictId, verdict: 'kill' },
    ]);
    const events = await db
      .selectFrom('app.financeRulingEvents')
      .select(['eventType', 'verdictId'])
      .where('userId', '=', owner)
      .execute();
    expect(events).toEqual([{ eventType: 'queued', verdictId }]);
    await db
      .insertInto('app.financeRulingEvents')
      .values({
        userId: owner,
        verdictId,
        eventType: 'filing',
      })
      .execute();
    expect(await FinanceRulingRepository.listEvents(db, other)).toEqual([]);
    expect(await FinanceRulingRepository.listEvents(db, owner)).toMatchObject([
      { verdictId, eventType: 'queued' },
      { verdictId, eventType: 'filing' },
    ]);
    await expect(
      FinanceRulingRepository.createVerdict(db, other, {
        preparationId,
        clusterId: 'cluster-2',
        merchant: 'sample',
        verdict: 'kill',
        rows: [],
      }),
    ).rejects.toThrow();
  });
});
