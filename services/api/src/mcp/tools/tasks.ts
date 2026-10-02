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
import { removedResultSchema } from '../../schemas/common.schema';
import {
  CreateTaskBatchSchema,
  CreateTaskSchema,
  taskBatchCreateOutputSchema,
  taskCompleteOutputSchema,
  taskCreateOutputSchema,
  taskDetailResultSchema,
  TaskListQuerySchema,
  taskListToolOutputSchema,
  TaskParamSchema,
  taskUpdateOutputSchema,
  UpdateTaskSchema,
} from '../../schemas/tasks.schema';
import { registerTool } from '../tool-registry';

// task_batch_create is the only supported way to create a task_list via MCP: a lone
// task_create with artifactType 'task_list' would have zero children, so task_list/
// task_detail would immediately (and correctly) report it back as a plain 'task'.
const taskCreateInputSchema = CreateTaskSchema.refine((data) => data.artifactType !== 'task_list', {
  message: 'Use task_batch_create to create a task list with subtasks',
  path: ['artifactType'],
});

// Baseline for a "create" tool (destructive: false, idempotent: false — each
// call produces a new row). Update/complete/delete tools override both below.
const writeTool: {
  readOnly: false;
  scopes: ['task:write'];
  resultCap: number;
  destructive: false;
  idempotent: false;
} = {
  readOnly: false,
  scopes: ['task:write'],
  resultCap: 1,
  destructive: false,
  idempotent: false,
};

registerTool(
  {
    name: 'task_list',
    title: 'List tasks',
    description:
      'Lists top-level tasks and task lists for the authenticated user. Supports filtering by ' +
      'status, priority, due date range (dueBefore/dueAfter), and a title text search (query) — ' +
      'use these instead of listing everything and filtering client-side, e.g. for "what is due ' +
      'today" or "what is overdue". Omit every filter the user did not ask for: with none it ' +
      'returns up to 100 tasks, and an unneeded filter silently hides the rest.',
    inputSchema: TaskListQuerySchema,
    // The model sends filters nobody asked for, which hide tasks without a due date; offer it
    // only the ones it can use correctly.
    chatInputSchema: TaskListQuerySchema.pick({ status: true, query: true }),
    outputSchema: taskListToolOutputSchema,
    readOnly: true,
    scopes: ['task:read'],
    resultCap: 100,
  },
  async (ownerUserId, input) => {
    const tasks = await listTasks(ownerUserId, input);
    const { limit: _limit, ...filters } = input;
    const applied = Object.entries(filters)
      .filter(([, value]) => value !== undefined)
      .map(([name]) => name);
    // A model that sets filters nobody asked for concludes the task does not exist;
    // tell it the empty result may be its own doing.
    if (tasks.length === 0 && applied.length > 0) {
      return {
        tasks,
        hint:
          `No tasks matched, but this search was filtered by ${applied.join(', ')}. ` +
          'Call task_list again with no filters before telling the user a task does not exist.',
      };
    }
    return { tasks };
  },
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
    standaloneWrite: true,
    name: 'task_create',
    title: 'Create a task',
    description:
      'Creates a standalone task, optionally assigning participants or nesting it under a parent task list. Use task_batch_create to create a task list with subtasks.',
    inputSchema: taskCreateInputSchema,
    outputSchema: taskCreateOutputSchema,
    guidance: {
      whenToUse:
        'The user says they need or want to do something, mentions a deadline or appointment, or asks to be reminded, even if they never say "add a task".',
      whenNotToUse:
        'Do not use for a durable fact or preference about the user; use remember for those.',
    },
  },
  async (ownerUserId, input) => ({ task: await createTask(ownerUserId, input) }),
);

registerTool(
  {
    ...writeTool,
    idempotent: true,
    name: 'task_update',
    title: 'Update a task',
    description:
      'Updates fields on a task (title, description, priority, due date, scheduling, location), optionally replacing its participants.',
    inputSchema: TaskParamSchema.extend({ data: UpdateTaskSchema }),
    outputSchema: taskUpdateOutputSchema,
    guidance: {
      whenToUse:
        'A matching task id has been returned by task_list. Resolve a loose reference such as "it" or "the gym thing" by listing tasks and matching titles.',
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
    idempotent: true,
    name: 'task_complete',
    title: 'Complete or reopen a task',
    description: 'Marks a task as completed or pending.',
    inputSchema: TaskParamSchema.extend({ completed: z.boolean() }),
    outputSchema: taskCompleteOutputSchema,
    guidance: {
      whenToUse:
        'The user says a task is done or asks to reopen it. Resolve a loose reference such as "it" or "the gym thing" by listing tasks and matching titles.',
      whenNotToUse:
        'The user wants a task gone, which is task_delete. Completing it is not a way to remove it.',
      dependencies: [{ tool: 'task_list', reason: 'resolve the stable task id', provides: ['id'] }],
    },
  },
  async (ownerUserId, input) => ({
    task: await completeTask(ownerUserId, input.id, input.completed),
  }),
);

registerTool(
  {
    ...writeTool,
    destructive: true,
    idempotent: true,
    requiresConfirmation: true,
    name: 'task_delete',
    title: 'Delete a task',
    description: 'Deletes a task. If it is a task list, its child tasks are deleted too.',
    inputSchema: TaskParamSchema,
    outputSchema: removedResultSchema,
    guidance: {
      whenToUse:
        'The user asked to delete or get rid of a task and a matching task id has been returned by task_list. Resolve a loose reference such as "it" or "the gym thing" by listing tasks and matching titles. Never call it before task_list has returned the task, and never with a guessed id. If task_list returns more than one task the words the user used could refer to (for example "passport" matching both "Renew passport" and "Passport photo appointment"), do not pick one and do not call this tool: ask which one they mean. Only once exactly one task matches, call this tool with that task\'s id: the app shows the user an approval prompt for it, so do not ask "do you want me to delete it?" in text first.',
      whenNotToUse:
        'Do not invent a task id. If several tasks could be the one the user means, ask which before calling; a guess is wrong even though the app asks for approval.',
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
    outputSchema: taskBatchCreateOutputSchema,
    resultCap: 20,
  },
  async (ownerUserId, input) => persistExtractedTasks(ownerUserId, input),
);
