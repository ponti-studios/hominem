import type { InferResponseType } from 'hono/client';

import type { HonoClient } from '../core/api-client';

type _OverviewEndpoint = HonoClient['api']['proactivity']['overview']['$get'];
export type ProactivityOverview = InferResponseType<_OverviewEndpoint, 200>;
export type ProactivityGoalRow = ProactivityOverview['goals'][number];
export type ProactivityFinance = NonNullable<ProactivityOverview['finance']>;

type _RunEndpoint = HonoClient['api']['proactivity']['run']['$post'];
export type ProactivityRunOutput = InferResponseType<_RunEndpoint, 200>;
export type ProactivityEvaluation = ProactivityRunOutput['evaluations'][number];
export type ProactivityIntent = ProactivityRunOutput['deliveryIntents'][number];
