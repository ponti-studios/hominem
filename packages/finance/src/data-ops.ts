import { db } from '@hominem/db';
import type {
  BudgetGoals,
  FinanceAccounts,
  FinanceTransactions,
  PlaidItems,
  Selectable,
  Tags,
} from '@hominem/db';
import { sql } from 'kysely';

import { listAccounts } from './accounts';
import { getTransactionTags } from './categories';
import { FINANCE_TRANSACTION_ENTITY_TYPE } from './contracts';
import { queryTransactionsByContract } from './transactions';
import { getAffectedRows, tableExists } from './utils';

export async function deleteUserFinanceData(user_id: string): Promise<{
  deletedTaggedItems: number;
  deletedTransactions: number;
  deletedAccounts: number;
  deletedBudgetGoals: number;
  deletedPlaidItems: number;
}> {
  const taggedItemsResult = await db
    .deleteFrom('tagged_items')
    .where(
      sql<boolean>`entity_type = ${FINANCE_TRANSACTION_ENTITY_TYPE} and entity_id in (select id from finance_transactions where user_id = ${user_id})`,
    )
    .executeTakeFirst();
  const deletedTaggedItems = getAffectedRows(taggedItemsResult);

  const transactionsResult = await db
    .deleteFrom('finance_transactions')
    .where('user_id', '=', user_id)
    .executeTakeFirst();
  const deletedTransactions = getAffectedRows(transactionsResult);

  const accountsResult = await db
    .deleteFrom('finance_accounts')
    .where('user_id', '=', user_id)
    .executeTakeFirst();
  const deletedAccounts = getAffectedRows(accountsResult);

  let deletedBudgetGoals = 0;
  if (await tableExists('budget_goals')) {
    const budgetGoalsResult = await db
      .deleteFrom('budget_goals')
      .where('user_id', '=', user_id)
      .executeTakeFirst();
    deletedBudgetGoals = getAffectedRows(budgetGoalsResult);
  }

  let deletedPlaidItems = 0;
  if (await tableExists('plaid_items')) {
    const plaidItemsResult = await db
      .deleteFrom('plaid_items')
      .where('user_id', '=', user_id)
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

export async function exportFinanceData(user_id: string): Promise<{
  accounts: Selectable<FinanceAccounts>[];
  transactions: Selectable<FinanceTransactions>[];
  tags: Selectable<Tags>[];
  budgetGoals: Selectable<BudgetGoals>[];
  plaidItems: Selectable<PlaidItems>[];
}> {
  const [accounts, transactions, tags] = await Promise.all([
    listAccounts(user_id),
    queryTransactionsByContract({ user_id, limit: 200, offset: 0 }),
    getTransactionTags(user_id),
  ]);

  let budgetGoals: Selectable<BudgetGoals>[] = [];
  if (await tableExists('budget_goals')) {
    const budgetGoalsResult = await db
      .selectFrom('budget_goals')
      .selectAll()
      .where('user_id', '=', user_id)
      .orderBy('created_at', 'desc')
      .orderBy('id', 'asc')
      .execute();
    budgetGoals = budgetGoalsResult;
  }

  let plaidItems: Selectable<PlaidItems>[] = [];
  if (await tableExists('plaid_items')) {
    const plaidItemsResult = await db
      .selectFrom('plaid_items')
      .selectAll()
      .where('user_id', '=', user_id)
      .orderBy('created_at', 'desc')
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
