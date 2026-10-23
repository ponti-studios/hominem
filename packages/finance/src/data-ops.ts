import { db } from '@hominem/db/core';
import type { Selectable } from '@hominem/db/core';
import type { AppFinanceTransactions, AppTags } from '@hominem/db/types';
import { sql } from 'kysely';

import type { AccountWithBalance } from './accounts';
import { listAccounts } from './accounts';
import { getTransactionTags } from './categories';
import { FINANCE_TRANSACTION_ENTITY_TYPE } from './contracts';
import { queryTransactionsByContract } from './transactions';
import { getAffectedRows } from './utils';

export async function deleteUserFinanceData(userId: string): Promise<{
  deletedTaggedItems: number;
  deletedTransactions: number;
  deletedAccounts: number;
}> {
  const taggedItemsResult = await db
    .deleteFrom('app.tagAssignments')
    .where(
      sql<boolean>`entity_table = ${FINANCE_TRANSACTION_ENTITY_TYPE}::regclass and entity_id in (select id from app.finance_transactions where user_id = ${userId})`,
    )
    .executeTakeFirst();
  const deletedTaggedItems = getAffectedRows(taggedItemsResult);

  const transactionsResult = await db
    .deleteFrom('app.financeTransactions')
    .where('userId', '=', userId)
    .executeTakeFirst();
  const deletedTransactions = getAffectedRows(transactionsResult);

  const accountsResult = await db
    .deleteFrom('app.financeAccounts')
    .where('userId', '=', userId)
    .executeTakeFirst();
  const deletedAccounts = getAffectedRows(accountsResult);

  return {
    deletedTaggedItems,
    deletedTransactions,
    deletedAccounts,
  };
}

export async function exportFinanceData(userId: string): Promise<{
  accounts: AccountWithBalance[];
  transactions: Selectable<AppFinanceTransactions>[];
  tags: Selectable<AppTags>[];
}> {
  const [accounts, transactions, tags] = await Promise.all([
    listAccounts(userId),
    queryTransactionsByContract({ userId, limit: 200, offset: 0 }),
    getTransactionTags(userId),
  ]);

  return {
    accounts,
    transactions,
    tags,
  };
}
