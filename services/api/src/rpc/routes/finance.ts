import { Hono } from 'hono';

import type { AppContext } from '../middleware/auth';
import { accountsRoutes } from './finance.accounts';
import { affordabilityRoutes } from './finance.affordability';
import { analyzeRoutes } from './finance.analyze';
import { budgetRoutes } from './finance.budget';
import { dataRoutes } from './finance.data';
import { exportRoutes } from './finance.export';
import { institutionsRoutes } from './finance.institutions';
import { ledgerRoutes } from './finance.ledger';
import { rulingsRoutes } from './finance.rulings';
import { runwayRoutes } from './finance.runway';
import { syncRoutes } from './finance.sync';
import { tagsRoutes } from './finance.tags';
import { transactionsRoutes } from './finance.transactions';
import { wealthRoutes } from './finance.wealth';

// Stitches together all the finance sub-routers (transactions, accounts,
// budget, etc.) under one router.

export const financeRoutes = new Hono<AppContext>()
  .route('/transactions', transactionsRoutes)
  .route('/accounts', accountsRoutes)
  .route('/analyze', analyzeRoutes)
  .route('/tags', tagsRoutes)
  .route('/budget', budgetRoutes)
  .route('/institutions', institutionsRoutes)
  .route('/ledger', ledgerRoutes)
  .route('/runway', runwayRoutes)
  .route('/sync', syncRoutes)
  .route('/rulings', rulingsRoutes)
  .route('/wealth', wealthRoutes)
  .route('/affordability', affordabilityRoutes)
  .route('/export', exportRoutes)
  .route('/data', dataRoutes);

export type AppType = typeof financeRoutes;
