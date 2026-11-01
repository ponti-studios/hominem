import { defineMcpSlice } from '../../../tool-registry';
import { financeBudgetCreateTool } from './create';
import { financeBudgetDeleteTool } from './delete';
import { financeBudgetGetTool } from './get';
import { financeBudgetListTool } from './list';
import { financePrimaryCurrencySetTool } from './primary-currency-set';
import { financeBudgetUpdateTool } from './update';

export const financeBudgetsSlice = defineMcpSlice({
  name: 'finance.budgets',
  tools: [
    financeBudgetListTool,
    financeBudgetGetTool,
    financeBudgetCreateTool,
    financeBudgetUpdateTool,
    financeBudgetDeleteTool,
    financePrimaryCurrencySetTool,
  ],
});
