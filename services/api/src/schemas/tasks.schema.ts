import { z } from 'zod';

export const TaskPriority = z.enum(['low', 'medium', 'high']);

const TaskParticipantSchema = z.uuid();

const TaskTimeFields = {
  durationMinutes: z.number().int().positive().nullable().optional(),
  schedulingWindowStartAt: z.iso.datetime({ offset: true }).nullable().optional(),
  schedulingWindowEndAt: z.iso.datetime({ offset: true }).nullable().optional(),
  scheduledStartAt: z.iso.datetime({ offset: true }).nullable().optional(),
  scheduledEndAt: z.iso.datetime({ offset: true }).nullable().optional(),
  timeZone: z.string().trim().min(1).nullable().optional(),
  location: z.string().trim().min(1).max(500).nullable().optional(),
};

function validateScheduledInterval(
  input: {
    scheduledStartAt?: string | null;
    scheduledEndAt?: string | null;
  },
  context: z.RefinementCtx,
) {
  const startProvided = input.scheduledStartAt !== undefined;
  const endProvided = input.scheduledEndAt !== undefined;
  if (startProvided !== endProvided) {
    context.addIssue({
      code: 'custom',
      message: 'scheduledStartAt and scheduledEndAt must be provided together',
      path: startProvided ? ['scheduledEndAt'] : ['scheduledStartAt'],
    });
    return;
  }

  if (
    input.scheduledStartAt &&
    input.scheduledEndAt &&
    new Date(input.scheduledEndAt) <= new Date(input.scheduledStartAt)
  ) {
    context.addIssue({
      code: 'custom',
      message: 'scheduledEndAt must be after scheduledStartAt',
      path: ['scheduledEndAt'],
    });
  }
}

export const CreateTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().optional().nullable(),
    artifactType: z.enum(['task', 'task_list']),
    priority: TaskPriority.optional(),
    dueAt: z.iso.datetime({ offset: true }).nullable().optional(),
    parentTaskId: z.uuid().nullable().optional(),
    participants: z.array(TaskParticipantSchema).max(20).optional(),
    ...TaskTimeFields,
  })
  .superRefine(validateScheduledInterval);

export const ExtractTasksInputSchema = z.object({
  transcript: z.string().min(1).max(20000),
});

export const VoiceTasksInputSchema = z.object({
  transcript: z.string().min(1).max(20000),
  referenceDate: z.iso.datetime().optional(),
  timezone: z.string().optional(),
});

export const ParseTimeBlockInputSchema = z.object({
  transcript: z.string().trim().min(1).max(20000),
  referenceDate: z.iso.datetime({ offset: true }).optional(),
  timezone: z.string().optional(),
  conversationContext: z.string().max(20000).optional(),
  calendarContext: z.string().max(20000).optional(),
});

const ExtractedTaskDraftSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional(),
});

export const CreateTaskBatchSchema = z
  .object({
    groups: z
      .array(
        z.object({
          title: z.string().trim().min(1).max(120),
          tasks: z.array(ExtractedTaskDraftSchema).min(2).max(20),
        }),
      )
      .max(10)
      .optional(),
    tasks: z.array(ExtractedTaskDraftSchema).max(20).optional(),
  })
  .refine((data) => (data.groups?.length ?? 0) + (data.tasks?.length ?? 0) > 0, {
    message: 'At least one task or group is required',
  });

export const TaskRecordSchema = z.object({
  id: z.uuid(),
  ownerUserId: z.uuid(),
  title: z.string(),
  description: z.string().nullable(),
  parentTaskId: z.uuid().nullable(),
  status: z.string(),
  priority: z.string(),
  dueAt: z.string().nullable(),
  durationMinutes: z.number().int().nullable(),
  schedulingWindowStartAt: z.string().nullable(),
  schedulingWindowEndAt: z.string().nullable(),
  scheduledStartAt: z.string().nullable(),
  scheduledEndAt: z.string().nullable(),
  timeZone: z.string().nullable(),
  location: z.string().nullable(),
  completedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  artifactType: z.enum(['task', 'task_list']),
});

export const TaskListRecordSchema = TaskRecordSchema.extend({
  childCount: z.number().int(),
});

export const TaskParticipantOutputSchema = z.object({
  personId: z.uuid(),
  displayName: z.string(),
  email: z.string().nullable(),
});

export const taskListResultSchema = z.object({
  tasks: z.array(TaskListRecordSchema),
});

export const taskDetailResultSchema = z.object({
  task: TaskRecordSchema.nullable(),
  participants: z.array(TaskParticipantOutputSchema),
  children: z.array(TaskRecordSchema),
});

export const TaskListQuerySchema = z.object({
  limit: z.number().int().min(1).max(100).optional().default(100),
  status: z.enum(['pending', 'completed']).optional(),
  priority: TaskPriority.optional(),
  dueBefore: z.iso.datetime({ offset: true }).optional(),
  dueAfter: z.iso.datetime({ offset: true }).optional(),
  query: z.string().trim().min(1).max(120).optional(),
});

export const TaskParamSchema = z.object({ id: z.uuid() });

export const UpdateTaskStatusSchema = z.object({ completed: z.boolean() });

export const UpdateTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    priority: TaskPriority.optional(),
    dueAt: z.iso.datetime({ offset: true }).nullable().optional(),
    participants: z.array(TaskParticipantSchema).max(20).optional(),
    ...TaskTimeFields,
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  })
  .superRefine(validateScheduledInterval);
