import * as z from 'zod';

export const CreateTaskSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().optional().nullable(),
  artifactType: z.enum(['task', 'task_list']),
});

export const ExtractTasksInputSchema = z.object({
  transcript: z.string().min(1).max(20000),
});

export const CreateTaskBatchSchema = z.object({
  tasks: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(120),
        description: z.string().trim().max(2000).optional(),
      }),
    )
    .min(1)
    .max(10),
});

export const TaskParamSchema = z.object({ id: z.uuid() });

export const UpdateTaskStatusSchema = z.object({ completed: z.boolean() });
