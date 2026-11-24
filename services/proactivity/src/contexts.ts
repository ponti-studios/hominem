import {
  buildCareerSnapshot,
  buildFinanceSnapshots,
  type CareerPipelineInput,
  type FinanceSnapshotInput,
} from './finance-facts.js';
import type { ProactivityDependencies } from './types.js';

type ContextLoader = ProactivityDependencies['contexts']['load'];

/**
 * Routes a goal to its context by domain: the first loader whose domain
 * appears in the goal's domains wins. Goals outside every loader's coverage
 * fail loudly instead of silently evaluating with empty context.
 */
export function createDomainContextAssembler(
  loaders: Record<string, ContextLoader>,
): ProactivityDependencies['contexts'] {
  return {
    async load(goal, trigger) {
      for (const domain of goal.domains) {
        const loader = loaders[domain];
        if (loader) return loader(goal, trigger);
      }
      throw new Error(
        `No context loader covers goal ${goal.id} (domains: ${goal.domains.join(', ')})`,
      );
    },
  };
}

/** Context loader for finance goals: previous full month vs current month. */
export function createFinanceContextLoader(input: FinanceSnapshotInput): ContextLoader {
  const { previous, current } = buildFinanceSnapshots(input);
  return async (goal, trigger) => ({ goal, trigger, previous, current });
}

/** Context loader for career goals: a single current snapshot of the pipeline. */
export function createCareerContextLoader(input: CareerPipelineInput): ContextLoader {
  const current = buildCareerSnapshot(input);
  return async (goal, trigger) => ({ goal, trigger, previous: null, current });
}
