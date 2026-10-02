import { convertSchemaToJsonSchema } from '@hominem/ai';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import './tools/tasks';
import { TaskListQuerySchema } from '../schemas/tasks.schema';
import { getToolDefinition } from './tool-registry';

describe('task tool contracts', () => {
  // The chat model is shown fewer task_list filters than the tool accepts: it kept sending
  // invented ones that hid tasks. Every caller can still use all of them.
  it('shows the chat model only status and query, but still accepts every filter', () => {
    const definition = getToolDefinition('task_list');
    const shown = z
      .object({ properties: z.record(z.string(), z.unknown()) })
      .parse(
        convertSchemaToJsonSchema(
          definition?.chatInputSchema ?? definition?.inputSchema ?? TaskListQuerySchema,
        ),
      );

    expect(Object.keys(shown.properties).sort()).toEqual(['query', 'status']);
    expect(
      definition?.inputSchema.safeParse({ priority: 'high', dueBefore: '2026-12-31T00:00:00Z' })
        .success,
    ).toBe(true);
  });

  // The engine withholds a tool until its prerequisites have run, so these declarations are
  // what stops a write being offered before the lookup that resolves its id.
  it('requires task_list before every task write that takes an id', () => {
    for (const name of ['task_update', 'task_complete', 'task_delete']) {
      const dependencies = getToolDefinition(name)?.guidance?.dependencies?.map((d) => d.tool);
      expect(dependencies, name).toEqual(['task_list']);
    }
  });
});
