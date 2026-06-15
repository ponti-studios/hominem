import type { InferResponseType } from 'hono/client';
import type { ArtifactType } from '@hominem/chat/types';
import type { HonoClient } from '../core/api-client';

type _TaskEndpoint = HonoClient['api']['tasks']['$post'];
export type Task = InferResponseType<_TaskEndpoint, 201>;

export type TasksCreateInput = {
  title: string;
  description?: string | null;
  artifactType: Exclude<ArtifactType, 'note' | 'tracker'>;
};

export type TasksCreateOutput = Task;
