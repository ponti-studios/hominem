export { createProactivityEngine } from './engine.js';
export { InMemoryJournal } from './memory.js';
export { goalScenarios } from './scenarios.js';
export {
  buildProactivityPrompt,
  createModelSlot,
  modelDecisionSchema,
  preflight,
  toProactivityDecision,
  ProactivitySlotError,
} from './slot.js';
export type {
  ModelDecision,
  ModelSlotOptions,
  ProactivityGenerate,
  ProactivityGenerateRequest,
} from './slot.js';
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
export {
  adjustMonthlyFlows,
  buildCareerSnapshot,
  buildFinanceSnapshots,
  reconcileTransferPairs,
} from './finance-facts.js';
export {
  createCareerContextLoader,
  createDomainContextAssembler,
  createFinanceContextLoader,
} from './contexts.js';
export type {
  AccountFlow,
  CareerPipelineInput,
  CategorySpend,
  FinanceSnapshotInput,
  IncomeEvent,
  MonthlyFlow,
  Reconciliation,
  TransferPair,
} from './finance-facts.js';
export type {
  ProactivityCareerSummary,
  ProactivityFinanceSummary,
  ProactivityGoalView,
  ProactivityOverview,
} from './overview.js';
