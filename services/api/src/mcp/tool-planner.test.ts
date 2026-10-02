import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { defineCapability } from '../application/capability';
import { validateChatToolPlan } from './tool-planner';

const lookup = defineCapability({
  name: 'lookup',
  title: 'Lookup',
  description: 'Finds a record.',
  inputSchema: z.object({ query: z.string() }),
  outputSchema: z.object({ id: z.string() }),
  readOnly: true,
  scopes: ['people:read'],
  resultCap: 10,
});

const detail = defineCapability({
  name: 'detail',
  title: 'Detail',
  description: 'Loads a record by id.',
  inputSchema: z.object({ id: z.string() }),
  outputSchema: z.object({ name: z.string() }),
  readOnly: true,
  scopes: ['people:read'],
  resultCap: 10,
});

const write = defineCapability({
  name: 'update',
  title: 'Update',
  description: 'Changes a record.',
  inputSchema: z.object({ id: z.string(), value: z.string() }),
  outputSchema: z.object({ updated: z.boolean() }),
  readOnly: false,
  scopes: ['people:write'],
  resultCap: 1,
  requiresConfirmation: true,
});

describe('validated chat tool plans', () => {
  it('accepts an ordered plan with schema-valid arguments', () => {
    expect(
      validateChatToolPlan(
        {
          requiresLookup: true,
          steps: [
            {
              tool: 'lookup',
              purpose: 'Resolve the person',
              dependsOn: [],
              arguments: { query: 'Ada' },
            },
            {
              tool: 'detail',
              purpose: 'Load the resolved person',
              dependsOn: ['lookup'],
              arguments: { id: 'person-1' },
            },
          ],
        },
        [lookup, detail],
      ),
    ).toEqual(expect.objectContaining({ ok: true }));
  });

  it('rejects unknown tools, invalid arguments, and forward dependencies', () => {
    const result = validateChatToolPlan(
      {
        requiresLookup: true,
        steps: [
          { tool: 'detail', purpose: 'Load detail', dependsOn: ['lookup'], arguments: { id: 42 } },
          { tool: 'missing', purpose: 'Unavailable', dependsOn: [], arguments: {} },
        ],
      },
      [lookup, detail],
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual(
        expect.arrayContaining([
          'detail depends on lookup, which is not scheduled earlier',
          'detail has invalid planned arguments: id',
          'Unknown tool: missing',
        ]),
      );
    }
  });

  it('rejects cycles and inconsistent lookup flags', () => {
    const cycle = validateChatToolPlan(
      {
        requiresLookup: true,
        steps: [
          { tool: 'lookup', purpose: 'First', dependsOn: ['detail'], arguments: { query: 'Ada' } },
          {
            tool: 'detail',
            purpose: 'Second',
            dependsOn: ['lookup'],
            arguments: { id: 'person-1' },
          },
        ],
      },
      [lookup, detail],
    );
    const noLookup = validateChatToolPlan({ requiresLookup: false, steps: [] }, [lookup, detail]);

    expect(cycle.ok).toBe(false);
    if (!cycle.ok) expect(cycle.errors).toContain('Tool plan contains a dependency cycle');
    expect(noLookup).toEqual({ ok: true, plan: { requiresLookup: false, steps: [] } });
  });

  it('requires a read before a confirmation-required write', () => {
    const result = validateChatToolPlan(
      {
        requiresLookup: true,
        steps: [
          {
            tool: 'update',
            purpose: 'Update the record',
            dependsOn: [],
            arguments: { id: 'person-1', value: 'new value' },
          },
        ],
      },
      [write],
    );

    expect(result).toEqual({
      ok: false,
      errors: ['update requires a preceding read-only lookup'],
    });
  });

  it('lets a standalone write be the first planned step', () => {
    const standalone = defineCapability({
      name: 'create',
      title: 'Create',
      description: 'Creates a record that depends on no existing one.',
      inputSchema: z.object({ title: z.string() }),
      outputSchema: z.object({ created: z.boolean() }),
      readOnly: false,
      scopes: ['people:write'],
      resultCap: 1,
      standaloneWrite: true,
    });

    expect(
      validateChatToolPlan(
        {
          requiresLookup: true,
          steps: [{ tool: 'create', purpose: 'Create it', dependsOn: [], arguments: {} }],
        },
        [standalone],
      ),
    ).toEqual(expect.objectContaining({ ok: true }));
  });

  it('rejects a dependent write scheduled before its lookup', () => {
    const result = validateChatToolPlan(
      {
        requiresLookup: true,
        steps: [
          {
            tool: 'update',
            purpose: 'Update the record',
            dependsOn: ['lookup'],
            arguments: { id: 'person-1', value: 'new value' },
          },
          {
            tool: 'lookup',
            purpose: 'Find the record',
            dependsOn: [],
            arguments: { query: 'Ada' },
          },
        ],
      },
      [lookup, write],
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain('update depends on lookup, which is not scheduled earlier');
    }
  });
});
