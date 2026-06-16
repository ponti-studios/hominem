import type { InferRequestType, InferResponseType } from 'hono/client';

import type { HonoClient } from '../core/api-client';

type VoiceCleanupRoute = HonoClient['api']['voice']['cleanup']['$post'];

export type VoiceCleanupInput = InferRequestType<VoiceCleanupRoute>['json'];
export type VoiceCleanupOutput = InferResponseType<VoiceCleanupRoute, 200>;
