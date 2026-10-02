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

const standalone = (name: string) =>
  defineCapability({
    name,
    title: name,
    description: 'A write that depends on no existing record.',
    inputSchema: z.object({ title: z.string() }),
    outputSchema: z.object({ created: z.boolean() }),
    readOnly: false,
    scopes: ['people:write'],
    resultCap: 1,
    standaloneWrite: true,
  });

const step = (tool: string, dependsOn: string[] = []) => ({ tool, purpose: tool, dependsOn });
const validate = (
  steps: ReturnType<typeof step>[],
  definitions: Parameters<typeof validateChatToolPlan>[1],
) => validateChatToolPlan({ steps }, definitions);

describe('validated chat tool plans', () => {
  it('accepts an ordered plan', () => {
    expect(validate([step('lookup'), step('detail', ['lookup'])], [lookup, detail])).toEqual(
      expect.objectContaining({ ok: true }),
    );
  });

  it('rejects unknown tools and forward dependencies', () => {
    const result = validate([step('detail', ['lookup']), step('missing')], [lookup, detail]);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual(
        expect.arrayContaining([
          'detail depends on lookup, which is not scheduled earlier',
          'Unknown tool: missing',
        ]),
      );
    }
  });

  it('rejects cycles and an empty plan', () => {
    const cycle = validate(
      [step('lookup', ['detail']), step('detail', ['lookup'])],
      [lookup, detail],
    );
    const empty = validate([], [lookup, detail]);

    expect(cycle.ok).toBe(false);
    if (!cycle.ok) expect(cycle.errors).toContain('Tool plan contains a dependency cycle');
    expect(empty).toEqual({ ok: false, errors: ['A lookup plan must contain at least one tool'] });
  });

  it('requires a read before a confirmation-required write', () => {
    expect(validate([step('update')], [write])).toEqual({
      ok: false,
      errors: ['update requires a preceding read-only lookup'],
    });
  });

  it('lets a standalone write be the first planned step', () => {
    expect(validate([step('create')], [standalone('create')])).toEqual(
      expect.objectContaining({ ok: true }),
    );
  });

  it('rejects a dependent write scheduled before its lookup', () => {
    const result = validate([step('update', ['lookup']), step('lookup')], [lookup, write]);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain('update depends on lookup, which is not scheduled earlier');
    }
  });

  // A standalone write is not a read, and the runtime guard looks for a completed read.
  it('does not accept a write after only a standalone write', () => {
    const result = validate(
      [step('remember_it'), step('update', ['remember_it'])],
      [standalone('remember_it'), write],
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain('update requires a preceding read-only lookup');
  });

  it('rejects a plan that is not in the plain shape the provider is asked for', () => {
    expect(validateChatToolPlan({ steps: [{ tool: 'lookup' }] }, [lookup]).ok).toBe(false);
  });
});
