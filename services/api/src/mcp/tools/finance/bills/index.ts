import { defineMcpSlice } from '../../../tool-registry';
import { financeBillCreateTool } from './create';
import { financeBillDeleteTool } from './delete';
import { financeBillGetTool } from './get';
import { financeBillListTool } from './list';
import { financeBillLogBalanceTool } from './log-balance';
import { financeBillUpdateTool } from './update';

export const financeBillsSlice = defineMcpSlice({
  name: 'finance.bills',
  tools: [
    financeBillListTool,
    financeBillGetTool,
    financeBillCreateTool,
    financeBillUpdateTool,
    financeBillDeleteTool,
    financeBillLogBalanceTool,
  ],
});
