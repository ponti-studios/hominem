export { createProactivityEngine } from './engine.js';
export { InMemoryJournal } from './memory.js';
export { goalScenarios } from './scenarios.js';
export {
  deliveryIntentSchema,
  evaluationRunSchema,
  goalContextSchema,
  goalSchema,
  proactivityDecisionSchema,
  proactivityTriggerSchema,
  stateSnapshotSchema,
} from './types.js';
export type {
  DeliveryIntent,
  Evaluation,
  EvaluationJournal,
  EvaluationRun,
  Evidence,
  Goal,
  GoalContext,
  GoalOutcome,
  ProactivityDecision,
  ProactivityDependencies,
  ProactivityTrigger,
  StateSnapshot,
} from './types.js';
export type { GoalScenario } from './scenarios.js';
