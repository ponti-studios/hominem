import { z } from 'zod';

import {
  completeTask,
  createTask,
  deleteTask,
  getTaskDetail,
  listTasks,
  persistExtractedTasks,
  updateTask,
} from '../../application/task.service';
import {
  CreateTaskBatchSchema,
  CreateTaskSchema,
  TaskListQuerySchema,
  TaskParamSchema,
  TaskRecordSchema,
  UpdateTaskSchema,
  taskDetailResultSchema,
  taskListResultSchema,
} from '../../schemas/tasks.schema';
import { registerTool } from '../tool-registry';

// task_batch_create is the only supported way to create a task_list via MCP: a lone
// task_create with artifactType 'task_list' would have zero children, so task_list/
// task_detail would immediately (and correctly) report it back as a plain 'task'.
const taskCreateInputSchema = CreateTaskSchema.refine((data) => data.artifactType !== 'task_list', {
  message: 'Use task_batch_create to create a task list with subtasks',
  path: ['artifactType'],
});

const writeTool: { readOnly: false; scopes: ['task:write']; resultCap: number } = {
  readOnly: false,
  scopes: ['task:write'],
  resultCap: 1,
};

registerTool(
  {
    name: 'task_list',
    title: 'List tasks',
    description: 'Lists top-level tasks and task lists for the authenticated user.',
    inputSchema: TaskListQuerySchema,
    outputSchema: taskListResultSchema,
    readOnly: true,
    scopes: ['task:read'],
    resultCap: 100,
  },
  async (ownerUserId, input) => ({ tasks: await listTasks(ownerUserId, input.limit) }),
);

registerTool(
  {
    name: 'task_detail',
    title: 'Get task detail',
    description:
      'Returns a task or task list by id, including its children (if a list) and assigned participants.',
    inputSchema: TaskParamSchema,
    outputSchema: taskDetailResultSchema,
    readOnly: true,
    scopes: ['task:read'],
    // Children/participants are DB-capped at 200/20 respectively (TaskRepository), so
    // this only needs to exceed those ceilings, not paginate a single task's detail view.
    resultCap: 200,
  },
  async (ownerUserId, input) => getTaskDetail(ownerUserId, input.id),
);

registerTool(
  {
    ...writeTool,
    name: 'task_create',
    title: 'Create a task',
    description:
      'Creates a standalone task, optionally assigning participants or nesting it under a parent task list. Use task_batch_create to create a task list with subtasks.',
    inputSchema: taskCreateInputSchema,
    outputSchema: z.object({ task: TaskRecordSchema }),
  },
  async (ownerUserId, input) => ({ task: await createTask(ownerUserId, input) }),
);

registerTool(
  {
    ...writeTool,
    name: 'task_update',
    title: 'Update a task',
    description:
      'Updates fields on a task (title, description, priority, due date, scheduling, location), optionally replacing its participants.',
    inputSchema: TaskParamSchema.extend({ data: UpdateTaskSchema }),
    outputSchema: z.object({ task: TaskRecordSchema.nullable() }),
    guidance: {
      whenToUse: 'A matching task id has been returned by task_list or task_detail.',
      whenNotToUse: 'Do not invent a task id.',
      dependencies: [{ tool: 'task_list', reason: 'resolve the stable task id', provides: ['id'] }],
    },
  },
  async (ownerUserId, input) => ({
    task: await updateTask(ownerUserId, input.id, input.data),
  }),
);

registerTool(
  {
    ...writeTool,
    name: 'task_complete',
    title: 'Complete or reopen a task',
    description: 'Marks a task as completed or pending.',
    inputSchema: TaskParamSchema.extend({ completed: z.boolean() }),
    outputSchema: z.object({ task: TaskRecordSchema.nullable() }),
  },
  async (ownerUserId, input) => ({
    task: await completeTask(ownerUserId, input.id, input.completed),
  }),
);

registerTool(
  {
    ...writeTool,
    requiresConfirmation: true,
    name: 'task_delete',
    title: 'Delete a task',
    description: 'Deletes a task. If it is a task list, its child tasks are deleted too.',
    inputSchema: TaskParamSchema,
    outputSchema: z.object({ removed: z.boolean() }),
    guidance: {
      whenToUse: 'A matching task id has been returned by task_list or task_detail.',
      whenNotToUse: 'Do not invent a task id or delete before lookup and confirmation.',
      dependencies: [{ tool: 'task_list', reason: 'resolve the stable task id', provides: ['id'] }],
    },
    preview: async (ownerUserId, input) => {
      const parsed = TaskParamSchema.safeParse(input);
      if (!parsed.success) return null;
      const { task } = await getTaskDetail(ownerUserId, parsed.data.id);
      return task ? { title: task.title, artifactType: task.artifactType } : null;
    },
  },
  async (ownerUserId, input) => ({ removed: await deleteTask(ownerUserId, input.id) }),
);

registerTool(
  {
    ...writeTool,
    name: 'task_batch_create',
    title: 'Create a task list with subtasks',
    description:
      'Creates one or more task-list groups (each with subtasks) and/or standalone tasks in a single call.',
    inputSchema: CreateTaskBatchSchema,
    outputSchema: z.object({
      groups: z.array(z.object({ parent: TaskRecordSchema, tasks: z.array(TaskRecordSchema) })),
      tasks: z.array(TaskRecordSchema),
    }),
    resultCap: 20,
  },
  async (ownerUserId, input) => persistExtractedTasks(ownerUserId, input),
);
