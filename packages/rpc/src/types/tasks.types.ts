import type { InferRequestType, InferResponseType } from 'hono/client';
import type { HonoClient } from '../core/api-client';

type _TasksCreateEndpoint = HonoClient['api']['tasks']['$post'];
export type Task = InferResponseType<_TasksCreateEndpoint, 201>;
export type TasksCreateInput = InferRequestType<_TasksCreateEndpoint>['json'];
export type TasksCreateOutput = Task;
