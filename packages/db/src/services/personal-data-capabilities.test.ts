import { randomUUID } from 'node:crypto';

import { afterEach, describe, expect, it } from 'vitest';

import { authDb, db } from '../db';
import { CalendarImportRepository } from './calendar/calendar-import.repository';
import { CalendarQueryRepository } from './calendar/calendar-query.repository';
import { FinanceQueryRepository } from './finance/finance-query.repository';

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
      provider: 'calendar-fixture',
      sourceExternalAccountId: 'calendar-fixture',
      sourceDisplayName: 'Fixture Calendar',
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
        sourceSystem: 'calendar-fixture',
        sourceFile: 'march-trip.ics',
      },
    });
    expect(JSON.stringify(results[0])).not.toContain('Private dinner notes');

    const detail = await CalendarQueryRepository.getOccurrence(userId, results[0]!.occurrenceId);

    expect(detail).toMatchObject({
      occurrenceId: results[0]!.occurrenceId,
      title: 'Dinner in Nashville',
      evidence: {
        sourceSystem: 'calendar-fixture',
        sourceFile: 'march-trip.ics',
      },
    });
    expect(JSON.stringify(detail)).not.toContain('raw/calendar/march-trip.ics');
  });

  it('returns upcoming calendar occurrences ordered, bounded, and without cancellations', async () => {
    const userId = await createUser();
    await CalendarImportRepository.importOccurrences(userId, {
      provider: 'calendar-fixture',
      sourceExternalAccountId: 'calendar-upcoming',
      sourceDisplayName: 'Fixture Calendar',
      occurrences: [
        {
          calendarUid: 'cancelled-lunch',
          occurrenceKey: '2026-03-12T18:00:00.000Z',
          title: 'Cancelled lunch',
          startsAt: '2026-03-12T18:00:00.000Z',
          endsAt: '2026-03-12T19:00:00.000Z',
          isAllDay: false,
          isCancelled: true,
          contentHash: 'cancelled-lunch',
          rawObjectKey: 'raw/calendar/cancelled-lunch.ics',
        },
        {
          calendarUid: 'all-day-conference',
          occurrenceKey: '2026-03-13',
          title: 'All-day conference',
          startsAt: '2026-03-13T00:00:00.000Z',
          occurrenceDate: '2026-03-13',
          isAllDay: true,
          isCancelled: false,
          contentHash: 'all-day-conference',
          rawObjectKey: 'raw/calendar/all-day-conference.ics',
        },
        {
          calendarUid: 'morning-flight',
          occurrenceKey: '2026-03-12T14:00:00.000Z',
          title: 'Morning flight',
          startsAt: '2026-03-12T14:00:00.000Z',
          endsAt: '2026-03-12T16:00:00.000Z',
          isAllDay: false,
          isCancelled: false,
          contentHash: 'morning-flight',
          rawObjectKey: 'raw/calendar/morning-flight.ics',
        },
      ],
    });

    const upcoming = await CalendarQueryRepository.upcoming(userId, {
      startsFrom: '2026-03-12T00:00:00.000Z',
      startsBefore: '2026-03-14T00:00:00.000Z',
    });

    expect(upcoming.map((event) => event.title)).toEqual([
      'Morning flight',
      'All-day conference',
    ]);
    expect(upcoming[1]).toMatchObject({
      occurrenceDate: '2026-03-13',
      isAllDay: true,
    });
    expect(upcoming.every((event) => !event.isCancelled)).toBe(true);

    const cancelled = await CalendarQueryRepository.search(userId, {
      query: 'Cancelled',
      startsFrom: '2026-03-12T00:00:00.000Z',
      startsBefore: '2026-03-14T00:00:00.000Z',
      includeCancelled: true,
    });

    expect(cancelled).toHaveLength(1);
    expect(cancelled[0]).toMatchObject({
      title: 'Cancelled lunch',
      isCancelled: true,
    });
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

  it('caps finance summary evidence and excludes transactions outside the month', async () => {
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
          amount: -10,
          transactionType: 'debit',
          postedOn: '2026-03-01',
          merchantName: 'Coffee',
          description: 'Morning coffee',
        },
        {
          id: randomUUID(),
          userId,
          accountId,
          amount: -20,
          transactionType: 'debit',
          postedOn: '2026-03-02',
          merchantName: 'Lunch',
          description: 'Lunch',
        },
        {
          id: randomUUID(),
          userId,
          accountId,
          amount: 100,
          transactionType: 'credit',
          postedOn: '2026-03-03',
          merchantName: 'Client',
          description: 'Invoice',
        },
        {
          id: randomUUID(),
          userId,
          accountId,
          amount: -999,
          transactionType: 'debit',
          postedOn: '2026-04-01',
          merchantName: 'April',
          description: 'Out of range',
        },
      ])
      .execute();

    const summary = await FinanceQueryRepository.monthlySummary(userId, {
      month: '2026-03',
      limit: 2,
    });

    expect(summary).toMatchObject({
      month: '2026-03',
      startsOn: '2026-03-01',
      endsBefore: '2026-04-01',
      totalSpent: 30,
      totalIncome: 100,
      transactionCount: 3,
    });
    expect(summary.transactions).toHaveLength(2);
    expect(summary.topMerchants.map((merchant) => merchant.merchantName)).toEqual([
      'Lunch',
      'Coffee',
    ]);
    expect(JSON.stringify(summary)).not.toContain('Out of range');
    expect(JSON.stringify(summary)).not.toContain('providerPayload');
  });
});
