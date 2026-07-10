import { randomUUID } from 'node:crypto';

import { afterEach, describe, expect, it } from 'vitest';

import { authDb, db } from '../db';
import { CalendarImportRepository } from './calendar/calendar-import.repository';
import { CalendarQueryRepository } from './calendar/calendar-query.repository';
import { FinanceQueryRepository } from './finance/finance-query.repository';
import { ImportHealthRepository } from './imports/import-health.repository';

const runIntegration = process.env.NODE_ENV === 'test' ? describe : describe.skip;

runIntegration('personal data read capabilities', () => {
  const userIds: string[] = [];
  const institutionIds: string[] = [];

  afterEach(async () => {
    for (const userId of userIds.splice(0)) {
      await db.deleteFrom('app.importSources').where('ownerUserid', '=', userId).execute();
      await db.deleteFrom('app.financeTransactions').where('userId', '=', userId).execute();
      await db.deleteFrom('app.financeAccounts').where('userId', '=', userId).execute();
      await authDb.deleteFrom('user').where('id', '=', userId).execute();
    }

    for (const institutionId of institutionIds.splice(0)) {
      await db.deleteFrom('app.financeInstitutions').where('id', '=', institutionId).execute();
    }
  });

  async function createUser(): Promise<string> {
    const userId = randomUUID();
    userIds.push(userId);
    await authDb
      .insertInto('user')
      .values({ id: userId, name: 'Capabilities Test User', email: `${userId}@example.com` })
      .execute();
    return userId;
  }

  it('searches calendar metadata with redacted event evidence', async () => {
    const userId = await createUser();
    await CalendarImportRepository.importOccurrences(userId, {
      provider: 'warehouse',
      sourceExternalAccountId: 'calendar-fixture',
      sourceDisplayName: 'Warehouse Calendar',
      inputObjectKey: 'imports/calendar/source.sqlite',
      inputChecksum: 'calendar-fixture-checksum',
      occurrences: [
        {
          calendarUid: 'march-trip',
          occurrenceKey: '2026-03-12T18:00:00.000Z',
          title: 'Dinner in Nashville',
          description: 'Private dinner notes should not leave the read model.',
          location: 'Nashville',
          startsAt: '2026-03-12T18:00:00.000Z',
          endsAt: '2026-03-12T20:00:00.000Z',
          isAllDay: false,
          isCancelled: false,
          contentHash: 'calendar-fixture-occurrence',
          rawObjectKey: 'raw/calendar/march-trip.ics',
        },
      ],
    });

    const results = await CalendarQueryRepository.search(userId, {
      query: 'Nashville',
      startsFrom: '2026-03-01T00:00:00.000Z',
      startsBefore: '2026-04-01T00:00:00.000Z',
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      title: 'Dinner in Nashville',
      location: 'Nashville',
      isCancelled: false,
      evidence: {
        sourceSystem: 'warehouse',
        sourceFile: 'march-trip.ics',
      },
    });
    expect(JSON.stringify(results[0])).not.toContain('Private dinner notes');
  });

  it('summarizes monthly spending and merchant destinations', async () => {
    const userId = await createUser();
    const institutionId = randomUUID();
    const accountId = randomUUID();
    institutionIds.push(institutionId);

    await db
      .insertInto('app.financeInstitutions')
      .values({ id: institutionId, name: 'Test Bank' })
      .execute();
    await db
      .insertInto('app.financeAccounts')
      .values({
        id: accountId,
        userId,
        institutionId,
        name: 'Personal Checking',
        accountType: 'checking',
      })
      .execute();
    await db
      .insertInto('app.financeTransactions')
      .values([
        {
          id: randomUUID(),
          userId,
          accountId,
          amount: -42.5,
          transactionType: 'debit',
          postedOn: '2026-03-03',
          merchantName: 'City Cafe',
          description: 'Coffee and lunch',
        },
        {
          id: randomUUID(),
          userId,
          accountId,
          amount: -120,
          transactionType: 'debit',
          postedOn: '2026-03-09',
          merchantName: 'Nashville Hotel',
          description: 'Hotel',
        },
        {
          id: randomUUID(),
          userId,
          accountId,
          amount: 2000,
          transactionType: 'credit',
          postedOn: '2026-03-31',
          merchantName: 'Client',
          description: 'Invoice',
        },
      ])
      .execute();

    const summary = await FinanceQueryRepository.monthlySummary(userId, { month: '2026-03' });

    expect(summary).toMatchObject({
      month: '2026-03',
      totalSpent: 162.5,
      totalIncome: 2000,
      transactionCount: 3,
    });
    expect(summary.topMerchants.map((merchant) => merchant.merchantName)).toEqual([
      'Nashville Hotel',
      'City Cafe',
    ]);
  });

  it('reports aggregate import and canonical data health without raw artifact keys', async () => {
    const userId = await createUser();
    await CalendarImportRepository.importOccurrences(userId, {
      provider: 'warehouse',
      sourceExternalAccountId: 'calendar-health',
      sourceDisplayName: 'Warehouse Calendar',
      occurrences: [
        {
          calendarUid: 'health-check',
          occurrenceKey: '2026-07-10T16:00:00.000Z',
          title: 'Health check',
          startsAt: '2026-07-10T16:00:00.000Z',
          endsAt: '2026-07-10T17:00:00.000Z',
          isAllDay: false,
          isCancelled: false,
          contentHash: 'health-check-occurrence',
          rawObjectKey: 'raw/calendar/health-check.ics',
        },
      ],
    });

    const health = await ImportHealthRepository.getPersonalDataHealth(userId);

    expect(health).toMatchObject({
      databaseAccessible: true,
      importSourceCount: 1,
      importRunCount: 1,
      rawRecordCount: 1,
      canonicalCounts: {
        calendarOccurrences: 1,
      },
    });
    expect(health.sources[0]).toMatchObject({
      provider: 'warehouse',
      sourceKind: 'calendar',
      runCount: 1,
      latestRunStatus: 'completed',
    });
    expect(JSON.stringify(health)).not.toContain('raw/calendar/health-check.ics');
  });
});
