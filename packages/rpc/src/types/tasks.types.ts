import type { InferRequestType, InferResponseType } from 'hono/client';
import type { HonoClient } from '../core/api-client';

type _TasksCreateEndpoint = HonoClient['api']['tasks']['$post'];
export type Task = InferResponseType<_TasksCreateEndpoint, 201>;
export type TasksCreateInput = InferRequestType<_TasksCreateEndpoint>['json'];
export type TasksCreateOutput = Task;

type _TasksListEndpoint = HonoClient['api']['tasks']['$get'];
export type TasksListOutput = InferResponseType<_TasksListEndpoint, 200>;
export type TaskListItem = TasksListOutput['tasks'][number];

type _TaskGetEndpoint = HonoClient['api']['tasks'][':id']['$get'];
export type TaskDetailOutput = InferResponseType<_TaskGetEndpoint, 200>;

type _TaskCompleteEndpoint = HonoClient['api']['tasks'][':id']['complete']['$patch'];
export type TaskCompleteInput = InferRequestType<_TaskCompleteEndpoint>['json'];
export type TaskCompleteOutput = InferResponseType<_TaskCompleteEndpoint, 200>;

type _TaskDeleteEndpoint = HonoClient['api']['tasks'][':id']['$delete'];
export type TaskDeleteOutput = InferResponseType<_TaskDeleteEndpoint, 200>;
