import * as z from 'zod';

import type { ArtifactType } from '@hominem/chat/types';

export interface Task {
  id: string;
  ownerUserId: string;
  title: string;
  description: string | null;
  parentTaskId: string | null;
  status: string;
  priority: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  artifactType: Exclude<ArtifactType, 'note' | 'tracker'>;
}

export type TasksCreateInput = {
  title: string;
  description?: string | null;
  artifactType: Exclude<ArtifactType, 'note' | 'tracker'>;
};

export type TasksCreateOutput = Task;

export const TasksCreateInputSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().optional().nullable(),
  artifactType: z.enum(['task', 'task_list']),
});
