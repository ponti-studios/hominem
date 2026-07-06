import type { InferRequestType, InferResponseType } from 'hono/client';

import type { HonoClient } from '../core/api-client';

type EnhanceRoute = HonoClient['api']['ai']['enhance']['$post'];
type UsageRoute = HonoClient['api']['ai']['usage']['$get'];

export type EnhanceTextInput = InferRequestType<EnhanceRoute>['json'];
export type EnhanceTextOutput = InferResponseType<EnhanceRoute, 200>;
export type AIUsageQuery = InferRequestType<UsageRoute>['query'];
export type AIUsageOutput = InferResponseType<UsageRoute, 200>;
