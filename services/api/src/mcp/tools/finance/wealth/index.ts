import { runBrief } from '../../../../application/finance.wealth.brief.service';
import { runClose } from '../../../../application/finance.wealth.close.service';
import { runCheck } from '../../../../application/finance.wealth.integrity.service';
import { runLook } from '../../../../application/finance.wealth.look.service';
import {
  financeWealthBriefInputSchema,
  financeWealthBriefOutputSchema,
  financeWealthCloseInputSchema,
  financeWealthCloseOutputSchema,
  financeWealthIntegrityInputSchema,
  financeWealthIntegrityOutputSchema,
  financeWealthLookInputSchema,
  financeWealthLookOutputSchema,
} from '../../../../schemas/finance.wealth.schema';
import { defineMcpSlice, defineMcpTool } from '../../../tool-registry';

const brief = defineMcpTool(
  {
    name: 'finance_wealth_brief',
    title: 'Wealth morning brief',
    description:
      'Report yesterday’s money movement, budget pacing, anomalies and bill changes. Pass the previous bill snapshot to compare it; the returned snapshot is not stored.',
    inputSchema: financeWealthBriefInputSchema,
    outputSchema: financeWealthBriefOutputSchema,
    readOnly: true,
    scopes: ['finance:read'],
    resultCap: 1,
  },
  async (ownerUserId, input) => runBrief(ownerUserId, input),
);

const look = defineMcpTool(
  {
    name: 'finance_wealth_look',
    title: 'Wealth forward look',
    description:
      'Project the next 30 days from the caller’s accounts and bills. Supply optional floors, card limits, salary rule and an explicit USD-to-GBP rate; no rate or inputs are persisted.',
    inputSchema: financeWealthLookInputSchema,
    outputSchema: financeWealthLookOutputSchema,
    readOnly: true,
    scopes: ['finance:read'],
    resultCap: 1,
  },
  async (ownerUserId, input) => runLook(ownerUserId, input),
);

const close = defineMcpTool(
  {
    name: 'finance_wealth_close',
    title: 'Wealth monthly close',
    description:
      'Produce the monthly close Markdown from the caller’s ledger. Optional dated anchors and a hygiene cache are supplied by the caller and are not stored.',
    inputSchema: financeWealthCloseInputSchema,
    outputSchema: financeWealthCloseOutputSchema,
    readOnly: true,
    scopes: ['finance:read'],
    resultCap: 1,
  },
  async (ownerUserId, input) => runClose(ownerUserId, input),
);

const integrity = defineMcpTool(
  {
    name: 'finance_wealth_integrity',
    title: 'Wealth ledger integrity',
    description:
      'Check the caller’s ledger against supplied sync watermarks, provider feed snapshots, manual anchors, cancellation watches and card statements. Nothing is stored.',
    inputSchema: financeWealthIntegrityInputSchema,
    outputSchema: financeWealthIntegrityOutputSchema,
    readOnly: true,
    scopes: ['finance:read'],
    resultCap: 100_000,
  },
  async (ownerUserId, input) => runCheck(ownerUserId, input),
);

export const financeWealthSlice = defineMcpSlice({
  name: 'finance.wealth',
  tools: [brief, look, close, integrity],
});
