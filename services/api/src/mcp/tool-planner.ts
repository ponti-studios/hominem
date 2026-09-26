import { z } from 'zod';

import type { CapabilityDefinition } from '../application/capability';

export const chatToolPlanStepSchema = z.object({
  tool: z.string().trim().min(1),
  purpose: z.string().trim().min(1).max(240),
  dependsOn: z.array(z.string().trim().min(1)).max(10),
  arguments: z.record(z.string(), z.unknown()).default({}),
});

export const chatToolPlanSchema = z.object({
  requiresLookup: z.boolean(),
  steps: z.array(chatToolPlanStepSchema).max(20),
});

export type ChatToolPlanStep = z.infer<typeof chatToolPlanStepSchema>;
export type ChatToolPlan = z.infer<typeof chatToolPlanSchema>;

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
  const scheduled = new Set<string>();

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
    if (!definition.readOnly && scheduled.size === 0) {
      errors.push(`${step.tool} requires a preceding read-only lookup`);
    }

    for (const dependency of step.dependsOn) {
      if (!available.has(dependency))
        errors.push(`${step.tool} depends on unknown tool ${dependency}`);
      if (!seen.has(dependency)) {
        errors.push(`${step.tool} depends on ${dependency}, which is not scheduled earlier`);
      }
    }

    // Planned arguments may intentionally omit values produced by an earlier
    // tool. Runtime callTool remains authoritative for the complete argument
    // object; the planner validates every value it does know about here.
    const result =
      definition.inputSchema instanceof z.ZodObject
        ? definition.inputSchema.partial().safeParse(step.arguments)
        : definition.inputSchema.safeParse(step.arguments);
    if (!result.success) {
      errors.push(
        `${step.tool} has invalid planned arguments: ${result.error.issues
          .map((issue) => issue.path.join('.') || '<root>')
          .join(', ')}`,
      );
    }
    scheduled.add(step.tool);
  }

  if (hasCycle(parsed.data.steps)) errors.push('Tool plan contains a dependency cycle');
  if (parsed.data.requiresLookup && parsed.data.steps.length === 0) {
    errors.push('A lookup plan must contain at least one tool');
  }
  if (!parsed.data.requiresLookup && parsed.data.steps.length > 0) {
    errors.push('A no-lookup plan cannot contain tool steps');
  }

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
