import type { InferResponseType } from 'hono/client';

import type { HonoClient } from '../core/api-client';

type _TelegramConnectionEndpoint = HonoClient['api']['telegram']['connection']['$get'];
type _TelegramLinkEndpoint = HonoClient['api']['telegram']['connection']['link']['$post'];
type _TelegramUnlinkEndpoint = HonoClient['api']['telegram']['connection']['$delete'];

export type TelegramConnection = InferResponseType<_TelegramConnectionEndpoint, 200>;
export type TelegramLinkResult = InferResponseType<_TelegramLinkEndpoint, 200>;
export type TelegramUnlinkResult = InferResponseType<_TelegramUnlinkEndpoint, 200>;
