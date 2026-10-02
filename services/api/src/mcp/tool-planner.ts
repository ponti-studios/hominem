import { z } from 'zod';

import type { CapabilityDefinition } from '../application/capability';

// The plan the model is asked for, and what is validated afterwards. Deliberately plain: a
// richer schema (a free-form `arguments` object, defaults) made the provider reject every plan
// request with "Provider returned error", so each plan silently fell back. The router has
// already decided whether a lookup is needed, and planned arguments were never executed.
export const chatToolPlanSchema = z.object({
  steps: z.array(
    z.object({ tool: z.string(), purpose: z.string(), dependsOn: z.array(z.string()) }),
  ),
});

export type ChatToolPlan = z.infer<typeof chatToolPlanSchema>;
export type ChatToolPlanStep = ChatToolPlan['steps'][number];

export type ToolPlanValidation = { ok: true; plan: ChatToolPlan } | { ok: false; errors: string[] };

function hasCycle(steps: readonly ChatToolPlanStep[]): boolean {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const dependencies = new Map(steps.map((step) => [step.tool, step.dependsOn]));

  function visit(tool: string): boolean {
    if (visiting.has(tool)) return true;
    if (visited.has(tool)) return false;
    visiting.add(tool);
    for (const dependency of dependencies.get(tool) ?? []) {
      if (visit(dependency)) return true;
    }
    visiting.delete(tool);
    visited.add(tool);
    return false;
  }

  return steps.some((step) => visit(step.tool));
}

export function validateChatToolPlan(
  input: unknown,
  definitions: readonly CapabilityDefinition[],
): ToolPlanValidation {
  const parsed = chatToolPlanSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map(
        (issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`,
      ),
    };
  }

  const available = new Map(definitions.map((definition) => [definition.name, definition]));
  const errors: string[] = [];
  const seen = new Set<string>();
  const scheduledReads = new Set<string>();

  for (const step of parsed.data.steps) {
    const definition = available.get(step.tool);
    if (!definition) {
      errors.push(`Unknown tool: ${step.tool}`);
      continue;
    }
    if (seen.has(step.tool)) errors.push(`Duplicate tool step: ${step.tool}`);
    seen.add(step.tool);

    const requiredDependencies =
      definition.guidance?.dependencies?.map((dependency) => dependency.tool) ?? [];
    const missingRequiredDependencies = requiredDependencies.filter(
      (dependency) => !step.dependsOn.includes(dependency),
    );
    if (missingRequiredDependencies.length > 0) {
      errors.push(
        `${step.tool} is missing required dependencies: ${missingRequiredDependencies.join(', ')}`,
      );
    }
    // The runtime guard needs a completed read-only call before such a write, so a standalone
    // write scheduled earlier (remember -> update) does not make the plan valid.
    if (!definition.readOnly && !definition.standaloneWrite && scheduledReads.size === 0) {
      errors.push(`${step.tool} requires a preceding read-only lookup`);
    }

    for (const dependency of step.dependsOn) {
      if (!available.has(dependency))
        errors.push(`${step.tool} depends on unknown tool ${dependency}`);
      if (!seen.has(dependency)) {
        errors.push(`${step.tool} depends on ${dependency}, which is not scheduled earlier`);
      }
    }

    if (definition.readOnly) scheduledReads.add(step.tool);
  }

  if (hasCycle(parsed.data.steps)) errors.push('Tool plan contains a dependency cycle');
  if (parsed.data.steps.length === 0) errors.push('A lookup plan must contain at least one tool');

  return errors.length > 0 ? { ok: false, errors } : { ok: true, plan: parsed.data };
}

export function buildToolCatalog(definitions: readonly CapabilityDefinition[]): string {
  return definitions
    .map((definition) => {
      return `${definition.name}: ${describeCapability(definition)}`;
    })
    .join('\n');
}

export function describeCapability(definition: CapabilityDefinition): string {
  const guidance = definition.guidance;
  const dependencies = guidance?.dependencies?.length
    ? ` Prerequisites: ${guidance.dependencies
        .map((dependency) => `${dependency.tool} (${dependency.reason})`)
        .join('; ')}.`
    : '';
  const produces = guidance?.produces?.length ? ` Produces: ${guidance.produces.join(', ')}.` : '';
  return [
    definition.description,
    `Mode: ${definition.readOnly ? 'read-only' : 'write'}${definition.requiresConfirmation ? ', confirmation required' : ''}.`,
    guidance?.whenToUse ? `Use when: ${guidance.whenToUse}` : '',
    guidance?.whenNotToUse ? `Do not use when: ${guidance.whenNotToUse}` : '',
    dependencies,
    produces,
  ]
    .filter(Boolean)
    .join(' ');
}
