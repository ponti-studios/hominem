import { db } from '@hominem/db';
import type {
  AppFinanceAccounts,
  AppFinanceTransactions,
  AppPlaidItems,
  AppTags,
  Selectable,
} from '@hominem/db';
import { sql } from 'kysely';

import { listAccounts } from './accounts';
import { getTransactionTags } from './categories';
import { FINANCE_TRANSACTION_ENTITY_TYPE } from './contracts';
import { queryTransactionsByContract } from './transactions';
import { getAffectedRows, tableExists } from './utils';

export async function deleteUserFinanceData(userId: string): Promise<{
  deletedTaggedItems: number;
  deletedTransactions: number;
  deletedAccounts: number;
  deletedBudgetGoals: number;
  deletedPlaidItems: number;
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

  let deletedBudgetGoals = 0;
  if (await tableExists('budget_goals')) {
    const budgetGoalsResult = await db
      .deleteFrom('budget_goals' as any)
      .where('userId', '=', userId)
      .executeTakeFirst();
    deletedBudgetGoals = getAffectedRows(budgetGoalsResult);
  }

  let deletedPlaidItems = 0;
  if (await tableExists('app.plaid_items')) {
    const plaidItemsResult = await db
      .deleteFrom('app.plaidItems')
      .where('userId', '=', userId)
      .executeTakeFirst();
    deletedPlaidItems = getAffectedRows(plaidItemsResult);
  }

  return {
    deletedTaggedItems,
    deletedTransactions,
    deletedAccounts,
    deletedBudgetGoals,
    deletedPlaidItems,
  };
}

export async function exportFinanceData(userId: string): Promise<{
  accounts: Selectable<AppFinanceAccounts>[];
  transactions: Selectable<AppFinanceTransactions>[];
  tags: Selectable<AppTags>[];
  budgetGoals: Record<string, unknown>[];
  plaidItems: Selectable<AppPlaidItems>[];
}> {
  const [accounts, transactions, tags] = await Promise.all([
    listAccounts(userId),
    queryTransactionsByContract({ userId, limit: 200, offset: 0 }),
    getTransactionTags(userId),
  ]);

  let budgetGoals: Record<string, unknown>[] = [];
  if (await tableExists('budget_goals')) {
    const budgetGoalsResult = await db
      .selectFrom('budget_goals' as any)
      .selectAll()
      .where('userId', '=', userId)
      .orderBy('createdAt', 'desc')
      .orderBy('id', 'asc')
      .execute();
    budgetGoals = budgetGoalsResult as Record<string, unknown>[];
  }

  let plaidItems: Selectable<AppPlaidItems>[] = [];
  if (await tableExists('app.plaid_items')) {
    const plaidItemsResult = await db
      .selectFrom('app.plaidItems')
      .selectAll()
      .where('userId', '=', userId)
      .orderBy('createdAt', 'desc')
      .orderBy('id', 'asc')
      .execute();
    plaidItems = plaidItemsResult;
  }

  return {
    accounts,
    transactions,
    tags,
    budgetGoals,
    plaidItems,
  };
}
