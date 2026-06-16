import * as z from 'zod';

export const CreateTaskSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().optional().nullable(),
  artifactType: z.enum(['task', 'task_list']),
});
