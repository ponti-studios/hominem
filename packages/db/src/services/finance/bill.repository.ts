import { sql, type Selectable } from 'kysely';

import { NotFoundError, ValidationError } from '../../errors';
import type { DbHandle } from '../../transaction';
import type { AppFinanceBillBalanceEntries, AppFinanceBills } from '../../types/database';

type FinanceBillRow = Selectable<AppFinanceBills>;
type FinanceBillBalanceRow = Selectable<AppFinanceBillBalanceEntries>;

function parseBillEnum<const Values extends readonly string[]>(
  value: string,
  values: Values,
  field: string,
): Values[number] {
  const parsed = values.find((candidate) => candidate === value);
  if (!parsed) throw new ValidationError(`Invalid ${field} value in finance bill storage.`);
  return parsed;
}

export const FINANCE_BILL_KINDS = [
  'electricity',
  'heating',
  'water',
  'broadband',
  'council_tax',
  'insurance',
  'rent',
  'other',
] as const;

export const FINANCE_BILL_PAYMENT_METHODS = [
  'direct_debit',
  'pay_as_you_go',
  'card',
  'manual',
  'other',
] as const;

export const FINANCE_BILL_AMOUNT_MODELS = ['fixed', 'variable', 'top_up'] as const;

export const FINANCE_BILL_CADENCES = [
  'weekly',
  'monthly',
  'quarterly',
  'annual',
  'one_off',
] as const;

export const FINANCE_BILL_STATUSES = ['active', 'paused', 'closed'] as const;

export const FINANCE_BILL_TYPES = ['suggested', 'confirmed', 'cancelled'] as const;

export const FINANCE_BILL_SUPPLY_STATUSES = ['connected', 'disconnected', 'unknown'] as const;

export const FINANCE_BILL_BALANCE_SOURCES = ['agent_portal', 'user_report', 'meter_photo'] as const;

export type FinanceBillKind = (typeof FINANCE_BILL_KINDS)[number];
export type FinanceBillPaymentMethod = (typeof FINANCE_BILL_PAYMENT_METHODS)[number];
export type FinanceBillAmountModel = (typeof FINANCE_BILL_AMOUNT_MODELS)[number];
export type FinanceBillCadence = (typeof FINANCE_BILL_CADENCES)[number];
export type FinanceBillStatus = (typeof FINANCE_BILL_STATUSES)[number];
export type FinanceBillType = (typeof FINANCE_BILL_TYPES)[number];
export type FinanceBillSupplyStatus = (typeof FINANCE_BILL_SUPPLY_STATUSES)[number];
export type FinanceBillBalanceSource = (typeof FINANCE_BILL_BALANCE_SOURCES)[number];

/** The bill as the API exposes it: flat, JSON-serializable, no row types. */
export type FinanceBillRecord = {
  id: string;
  userId: string;
  name: string;
  providerName: string | null;
  kind: FinanceBillKind;
  accountNumber: string | null;
  paymentMethod: FinanceBillPaymentMethod;
  amountModel: FinanceBillAmountModel;
  expectedAmountCents: number | null;
  currencyCode: string;
  cadence: FinanceBillCadence | null;
  dueDay: number | null;
  dueDate: string | null;
  anchorDate: string | null;
  status: FinanceBillStatus;
  type: FinanceBillType;
  isDismissed: boolean;
  lastDismissedAt: string | null;
  merchantMatch: string[];
  staleAfterHours: number;
  paygWarnDays: number;
  notes: string | null;
  accountId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FinanceBillWriteInput = {
  name: string;
  providerName?: string | null;
  kind: FinanceBillKind;
  accountNumber?: string | null;
  paymentMethod: FinanceBillPaymentMethod;
  amountModel: FinanceBillAmountModel;
  expectedAmountCents?: number | null;
  currencyCode: string;
  cadence?: FinanceBillCadence | null;
  dueDay?: number | null;
  dueDate?: string | null;
  anchorDate?: string | null;
  status?: FinanceBillStatus;
  type?: FinanceBillType;
  isDismissed?: boolean;
  merchantMatch?: string[];
  staleAfterHours?: number;
  paygWarnDays?: number;
  notes?: string | null;
  accountId?: string | null;
};

export type FinanceBillPatch = {
  name?: string;
  providerName?: string | null;
  kind?: FinanceBillKind;
  accountNumber?: string | null;
  paymentMethod?: FinanceBillPaymentMethod;
  amountModel?: FinanceBillAmountModel;
  expectedAmountCents?: number | null;
  currencyCode?: string;
  cadence?: FinanceBillCadence | null;
  dueDay?: number | null;
  dueDate?: string | null;
  anchorDate?: string | null;
  status?: FinanceBillStatus;
  type?: FinanceBillType;
  isDismissed?: boolean;
  merchantMatch?: string[];
  staleAfterHours?: number;
  paygWarnDays?: number;
  notes?: string | null;
  accountId?: string | null;
};

export type FinanceBillListFilters = {
  status?: FinanceBillStatus;
  type?: FinanceBillType;
  kind?: FinanceBillKind;
  limit?: number;
};

/** One append-only observation of a top-up bill's supplier balance. */
export type FinanceBillBalanceEntryRecord = {
  id: string;
  userId: string;
  billId: string;
  checkedAt: string;
  createdAt: string;
  balanceCents: number;
  meterReadingKwh: number | null;
  supplyStatus: FinanceBillSupplyStatus;
  source: FinanceBillBalanceSource;
  note: string | null;
};

export type FinanceBillBalanceWriteInput = {
  checkedAt: string;
  balanceCents: number;
  meterReadingKwh?: number | null;
  supplyStatus: FinanceBillSupplyStatus;
  source: FinanceBillBalanceSource;
  note?: string | null;
};

/**
 * A transaction matched to the earliest-created bill whose `merchant_match` contains a
 * case-insensitive substring of the transaction's merchant name or description. Excluded and
 * pending rows are never claimed: they are not payments.
 */
export type FinanceBillClaim = {
  billId: string;
  transactionId: string;
  postedOn: string;
  amount: number;
  currencyCode: string;
};

function toBill(row: FinanceBillRow): FinanceBillRecord {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    providerName: row.providerName,
    kind: parseBillEnum(row.kind, FINANCE_BILL_KINDS, 'kind'),
    accountNumber: row.accountNumber,
    paymentMethod: parseBillEnum(row.paymentMethod, FINANCE_BILL_PAYMENT_METHODS, 'payment method'),
    amountModel: parseBillEnum(row.amountModel, FINANCE_BILL_AMOUNT_MODELS, 'amount model'),
    expectedAmountCents: row.expectedAmountCents,
    currencyCode: row.currencyCode,
    cadence:
      row.cadence === null ? null : parseBillEnum(row.cadence, FINANCE_BILL_CADENCES, 'cadence'),
    dueDay: row.dueDay,
    dueDate: row.dueDate === null ? null : String(row.dueDate).slice(0, 10),
    anchorDate: row.anchorDate === null ? null : String(row.anchorDate).slice(0, 10),
    status: parseBillEnum(row.status, FINANCE_BILL_STATUSES, 'status'),
    type: parseBillEnum(row.type, FINANCE_BILL_TYPES, 'type'),
    isDismissed: row.isDismissed,
    lastDismissedAt: row.lastDismissedAt === null ? null : String(row.lastDismissedAt),
    merchantMatch: [...row.merchantMatch],
    staleAfterHours: row.staleAfterHours,
    paygWarnDays: row.paygWarnDays,
    notes: row.notes,
    accountId: row.accountId,
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  };
}

/**
 * Mirrors the `finance_bills_schedule_check` constraint with readable errors: a recurrence
 * needs something to be due on, a one-off needs its date, a top-up bill has no recurrence,
 * and a variable bill carries no expected amount. Runs on the merged row, so partial updates
 * cannot store a half-schedule either.
 */
function assertValidSchedule(input: {
  cadence?: string | null;
  dueDay?: number | null;
  dueDate?: string | null;
  anchorDate?: string | null;
  amountModel?: string;
  expectedAmountCents?: number | null;
}): void {
  const { cadence, dueDay, dueDate, anchorDate, amountModel, expectedAmountCents } = input;
  if (amountModel === 'top_up' && cadence !== null && cadence !== undefined) {
    throw new ValidationError('A top-up bill has no recurrence: omit its cadence.');
  }
  if (
    amountModel === 'variable' &&
    expectedAmountCents !== null &&
    expectedAmountCents !== undefined
  ) {
    throw new ValidationError(
      'A variable bill has no expected amount: omit expected_amount_cents.',
    );
  }
  if (cadence === null || cadence === undefined) {
    if (dueDay !== null && dueDay !== undefined) {
      throw new ValidationError('A bill with no cadence carries no due_day.');
    }
    if (dueDate !== null && dueDate !== undefined) {
      throw new ValidationError('A bill with no cadence carries no due_date.');
    }
    if (anchorDate !== null && anchorDate !== undefined) {
      throw new ValidationError('A bill with no cadence carries no anchor_date.');
    }
    return;
  }
  if (cadence === 'one_off') {
    if (dueDate === null || dueDate === undefined) {
      throw new ValidationError('A one-off bill needs its due_date.');
    }
    return;
  }
  if (dueDay === null || dueDay === undefined) {
    throw new ValidationError(`A ${cadence} bill needs its due_day.`);
  }
  if (
    (cadence === 'weekly' || cadence === 'quarterly' || cadence === 'annual') &&
    (anchorDate === null || anchorDate === undefined)
  ) {
    throw new ValidationError(`A ${cadence} bill steps from its anchor_date.`);
  }
}

function toBalanceEntry(row: FinanceBillBalanceRow): FinanceBillBalanceEntryRecord {
  return {
    id: row.id,
    userId: row.userId,
    billId: row.billId,
    checkedAt: String(row.checkedAt),
    createdAt: String(row.createdAt),
    balanceCents: row.balanceCents,
    meterReadingKwh: row.meterReadingKwh === null ? null : Number(row.meterReadingKwh),
    supplyStatus: parseBillEnum(row.supplyStatus, FINANCE_BILL_SUPPLY_STATUSES, 'supply status'),
    source: parseBillEnum(row.source, FINANCE_BILL_BALANCE_SOURCES, 'balance source'),
    note: row.note,
  };
}

/**
 * Bills are reference data: the row stores who the bill is with and what it should cost, and
 * every derivation (next due date, last paid, pay-as-you-go burn) is computed at read time. A
 * bill never creates, moves or edits a transaction.
 */
export const FinanceBillRepository = {
  async list(
    handle: DbHandle,
    ownerUserId: string,
    filters?: FinanceBillListFilters,
  ): Promise<FinanceBillRecord[]> {
    const rows = await handle
      .selectFrom('app.financeBills as bill')
      .selectAll('bill')
      .where('bill.userId', '=', ownerUserId)
      .$if(filters?.status !== undefined, (query) =>
        query.where('bill.status', '=', filters!.status!),
      )
      .$if(filters?.type !== undefined, (query) => query.where('bill.type', '=', filters!.type!))
      .$if(filters?.kind !== undefined, (query) => query.where('bill.kind', '=', filters!.kind!))
      .orderBy('bill.createdAt', 'asc')
      .orderBy('bill.id', 'asc')
      .limit(filters?.limit ?? 50)
      .execute();
    return rows.map(toBill);
  },

  async get(handle: DbHandle, ownerUserId: string, id: string): Promise<FinanceBillRecord | null> {
    const row = await handle
      .selectFrom('app.financeBills as bill')
      .selectAll('bill')
      .where('bill.id', '=', id)
      .where('bill.userId', '=', ownerUserId)
      .executeTakeFirst();
    return row ? toBill(row) : null;
  },

  /** Verifies an optional linked account belongs to the caller; bills never touch the account. */
  async findAccount(
    handle: DbHandle,
    ownerUserId: string,
    accountId: string,
  ): Promise<{ id: string } | null> {
    const row = await handle
      .selectFrom('app.financeAccounts')
      .select('id')
      .where('id', '=', accountId)
      .where('userId', '=', ownerUserId)
      .executeTakeFirst();
    return row ?? null;
  },

  async create(
    handle: DbHandle,
    ownerUserId: string,
    input: FinanceBillWriteInput,
  ): Promise<FinanceBillRecord> {
    if (input.accountId) {
      const account = await FinanceBillRepository.findAccount(handle, ownerUserId, input.accountId);
      if (!account) throw new NotFoundError('Finance account not found');
    }
    assertValidSchedule({
      cadence: input.cadence,
      dueDay: input.dueDay,
      dueDate: input.dueDate,
      anchorDate: input.anchorDate,
      amountModel: input.amountModel,
      expectedAmountCents: input.expectedAmountCents,
    });
    const created = await handle
      .insertInto('app.financeBills')
      .values({
        userId: ownerUserId,
        name: input.name.trim(),
        providerName: input.providerName?.trim() ? input.providerName.trim() : null,
        kind: input.kind,
        accountNumber: input.accountNumber ?? null,
        paymentMethod: input.paymentMethod,
        amountModel: input.amountModel,
        expectedAmountCents: input.expectedAmountCents ?? null,
        currencyCode: input.currencyCode.toUpperCase(),
        cadence: input.cadence ?? null,
        dueDay: input.dueDay ?? null,
        dueDate: input.dueDate ?? null,
        anchorDate: input.anchorDate ?? null,
        status: input.status ?? 'active',
        type: input.type ?? 'confirmed',
        isDismissed: input.isDismissed ?? false,
        lastDismissedAt: input.isDismissed ? new Date().toISOString() : null,
        merchantMatch: input.merchantMatch ?? [],
        staleAfterHours: input.staleAfterHours ?? 48,
        paygWarnDays: input.paygWarnDays ?? 7,
        notes: input.notes ?? null,
        accountId: input.accountId ?? null,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    const bill = await FinanceBillRepository.get(handle, ownerUserId, created.id);
    if (!bill) throw new NotFoundError('Finance bill not found');
    return bill;
  },

  /**
   * Detection lifecycle: `suggested` materialises the same row a user later confirms, `cancelled`
   * is terminal and can never be left, and dismissal lives on the suggested row itself. The
   * query both enforces ownership and applies the patch in one round trip.
   */
  async update(
    handle: DbHandle,
    ownerUserId: string,
    id: string,
    patch: FinanceBillPatch,
  ): Promise<FinanceBillRecord | null> {
    const current = await handle
      .selectFrom('app.financeBills as bill')
      .select([
        'bill.type as type',
        'bill.isDismissed as isDismissed',
        'bill.cadence as cadence',
        'bill.dueDay as dueDay',
        'bill.dueDate as dueDate',
        'bill.anchorDate as anchorDate',
        'bill.amountModel as amountModel',
        'bill.expectedAmountCents as expectedAmountCents',
      ])
      .where('bill.id', '=', id)
      .where('bill.userId', '=', ownerUserId)
      .executeTakeFirst();
    if (!current) return null;
    assertValidSchedule({
      cadence: patch.cadence !== undefined ? patch.cadence : current.cadence,
      dueDay: patch.dueDay !== undefined ? patch.dueDay : current.dueDay,
      dueDate:
        patch.dueDate !== undefined
          ? patch.dueDate
          : current.dueDate === null
            ? null
            : String(current.dueDate).slice(0, 10),
      anchorDate:
        patch.anchorDate !== undefined
          ? patch.anchorDate
          : current.anchorDate === null
            ? null
            : String(current.anchorDate).slice(0, 10),
      amountModel: patch.amountModel !== undefined ? patch.amountModel : current.amountModel,
      expectedAmountCents:
        patch.expectedAmountCents !== undefined
          ? patch.expectedAmountCents
          : current.expectedAmountCents,
    });

    if (patch.type !== undefined && patch.type !== current.type) {
      if (current.type === 'cancelled') {
        throw new ValidationError('A cancelled bill cannot be reopened.');
      }
      if (current.type === 'confirmed' && patch.type === 'suggested') {
        throw new ValidationError('A confirmed bill cannot return to suggested.');
      }
    }
    if (patch.isDismissed === true && (patch.type ?? current.type) !== 'suggested') {
      throw new ValidationError('Only a suggested bill can be dismissed.');
    }
    if (patch.accountId !== undefined && patch.accountId !== null) {
      const account = await FinanceBillRepository.findAccount(handle, ownerUserId, patch.accountId);
      if (!account) throw new NotFoundError('Finance account not found');
    }

    const { isDismissed, ...rest } = patch;
    const values: Record<string, unknown> = { ...rest };
    if (isDismissed !== undefined) {
      values.isDismissed = isDismissed;
      values.lastDismissedAt = isDismissed ? new Date().toISOString() : null;
    }
    // Confirming a suggestion clears its dismissal: the decision is made.
    if (patch.type === 'confirmed' && current.type === 'suggested' && isDismissed === undefined) {
      values.isDismissed = false;
      values.lastDismissedAt = null;
    }
    if (rest.name !== undefined) values.name = rest.name.trim();
    if (rest.providerName !== undefined) {
      values.providerName = rest.providerName?.trim() ? rest.providerName.trim() : null;
    }
    if (rest.currencyCode !== undefined) values.currencyCode = rest.currencyCode.toUpperCase();
    if (Object.keys(values).length === 0) {
      const unchanged = await FinanceBillRepository.get(handle, ownerUserId, id);
      return unchanged;
    }
    const result = await handle
      .updateTable('app.financeBills')
      .set({ ...values, updatedAt: new Date().toISOString() })
      .where('id', '=', id)
      .where('userId', '=', ownerUserId)
      .executeTakeFirst();
    if (Number(result.numUpdatedRows) === 0) return null;
    return FinanceBillRepository.get(handle, ownerUserId, id);
  },

  /** Balance entries cascade from the bill row, so removing the bill removes its log. */
  async remove(handle: DbHandle, ownerUserId: string, id: string): Promise<boolean> {
    const result = await handle
      .deleteFrom('app.financeBills')
      .where('id', '=', id)
      .where('userId', '=', ownerUserId)
      .executeTakeFirst();
    return Number(result.numDeletedRows) > 0;
  },

  async countBalanceEntries(
    handle: DbHandle,
    ownerUserId: string,
    billId: string,
  ): Promise<number> {
    const row = await handle
      .selectFrom('app.financeBillBalanceEntries')
      .select((eb) => eb.fn.count<string>('id').as('entryCount'))
      .where('userId', '=', ownerUserId)
      .where('billId', '=', billId)
      .executeTakeFirst();
    return Number(row?.entryCount ?? 0);
  },

  /**
   * Append-only: a balance entry is an observation ("balance X as of checked_at"), never an
   * edit — corrections are new rows. Only a top-up bill has a balance to observe.
   */
  async appendBalanceEntry(
    handle: DbHandle,
    ownerUserId: string,
    billId: string,
    input: FinanceBillBalanceWriteInput,
  ): Promise<FinanceBillBalanceEntryRecord> {
    const bill = await handle
      .selectFrom('app.financeBills as bill')
      .select(['bill.id as id', 'bill.amountModel as amountModel'])
      .where('bill.id', '=', billId)
      .where('bill.userId', '=', ownerUserId)
      .executeTakeFirst();
    if (!bill) throw new NotFoundError('Finance bill not found');
    if (bill.amountModel !== 'top_up') {
      throw new ValidationError('Balance entries belong to top-up bills only.');
    }
    const created = await handle
      .insertInto('app.financeBillBalanceEntries')
      .values({
        userId: ownerUserId,
        billId,
        checkedAt: input.checkedAt,
        balanceCents: input.balanceCents,
        meterReadingKwh: input.meterReadingKwh ?? null,
        supplyStatus: input.supplyStatus,
        source: input.source,
        note: input.note ?? null,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    const entry = await handle
      .selectFrom('app.financeBillBalanceEntries')
      .selectAll()
      .where('id', '=', created.id)
      .where('userId', '=', ownerUserId)
      .executeTakeFirst();
    if (!entry) throw new NotFoundError('Finance bill balance entry not found');
    return toBalanceEntry(entry);
  },

  /** A bill's log, most recent first. Unknown or unowned bills read as not found. */
  async listBalanceEntries(
    handle: DbHandle,
    ownerUserId: string,
    billId: string,
    limit = 50,
  ): Promise<FinanceBillBalanceEntryRecord[]> {
    const bill = await handle
      .selectFrom('app.financeBills as bill')
      .select('bill.id as id')
      .where('bill.id', '=', billId)
      .where('bill.userId', '=', ownerUserId)
      .executeTakeFirst();
    if (!bill) throw new NotFoundError('Finance bill not found');
    const rows = await handle
      .selectFrom('app.financeBillBalanceEntries')
      .selectAll()
      .where('userId', '=', ownerUserId)
      .where('billId', '=', billId)
      .orderBy('checkedAt', 'desc')
      .orderBy('id', 'desc')
      .limit(limit)
      .execute();
    return rows.map(toBalanceEntry);
  },

  /**
   * Awards every matched transaction to its earliest-created bill (`distinct on` + the
   * `(created_at, id)` order). Matching is a plain case-insensitive substring (`strpos`, not
   * `like`, so supplier codes containing `%` or `_` cannot escape the match) over the
   * transaction's merchant name or description.
   *
   * The outer `distinct on (billId)` keeps the latest claimed transaction per bill *before*
   * the row bound is applied, so a long transaction history can never hide the newest payment.
   */
  async findClaimedTransactions(
    handle: DbHandle,
    ownerUserId: string,
    limit = 10_000,
  ): Promise<FinanceBillClaim[]> {
    const rows = await sql<{
      billId: string;
      transactionId: string;
      postedOn: string;
      amount: string;
      currencyCode: string;
    }>`
      with claimed as (
        select distinct on (t.posted_on, t.id)
          b.id as "billId",
          t.id as "transactionId",
          t.posted_on as "postedOn",
          t.amount as amount,
          t.currency_code as "currencyCode"
        from app.finance_transactions t
        join app.finance_bills b
          on b.user_id = t.user_id
          and exists (
            select 1 from unnest(b.merchant_match) as m
            where m <> ''
              and (
                strpos(lower(coalesce(t.merchant_name, '')), lower(m)) > 0
                or strpos(lower(coalesce(t.description, '')), lower(m)) > 0
              )
          )
        where t.user_id = ${ownerUserId}
          and t.excluded = false
          and t.pending = false
        order by t.posted_on, t.id, b.created_at asc, b.id asc
      )
      select distinct on ("billId")
        "billId",
        "transactionId",
        "postedOn",
        amount,
        "currencyCode"
      from claimed
      order by "billId", "postedOn" desc, "transactionId" desc
      limit ${limit}
    `.execute(handle);
    return rows.rows.map((row) => ({
      billId: row.billId,
      transactionId: row.transactionId,
      postedOn: String(row.postedOn).slice(0, 10),
      amount: Number(row.amount),
      currencyCode: row.currencyCode,
    }));
  },
};
