import type { InferRequestType, InferResponseType } from 'hono/client';

import type { HonoClient } from '../core/api-client';

type EnhanceRoute = HonoClient['api']['enhance']['enhance']['$post'];

export type EnhanceTextInput = InferRequestType<EnhanceRoute>['json'];
export type EnhanceTextOutput = InferResponseType<EnhanceRoute, 200>;
