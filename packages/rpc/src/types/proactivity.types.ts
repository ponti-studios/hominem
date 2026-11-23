import type { InferRequestType, InferResponseType } from 'hono/client';

import type { HonoClient } from '../core/api-client';

type _StudioEndpoint = HonoClient['api']['proactivity']['studio']['$get'];
export type ProactivityStudioView = InferResponseType<_StudioEndpoint, 200>;

type _RunEndpoint = HonoClient['api']['proactivity']['run']['$post'];
export type ProactivityRunInput = InferRequestType<_RunEndpoint>['json'];
export type ProactivityRunOutput = InferResponseType<_RunEndpoint, 200>;

type _InjectEndpoint = HonoClient['api']['proactivity']['inject']['$post'];
export type ProactivityInjectInput = InferRequestType<_InjectEndpoint>['json'];
export type ProactivityInjectOutput = InferResponseType<_InjectEndpoint, 200>;

type _ResetEndpoint = HonoClient['api']['proactivity']['reset']['$post'];
export type ProactivityResetOutput = InferResponseType<_ResetEndpoint, 200>;
