import { createProactivityEngine } from '../engine.js';
import { createOpenRouterProactivitySlot } from '../openrouter-slot.js';
import { preflight } from '../slot.js';
import type {
  EvaluationRun,
  GoalContext,
  ProactivityDecision,
  ProactivityTrigger,
} from '../types.js';
import type {
  DecisionKind,
  StudioAction,
  StudioDay,
  StudioEvent,
  StudioGoal,
  StudioPreference,
  StudioResult,
  StudioStats,
  StudioView,
} from './contract.js';
import { createStudioDeliveryPolicy } from './delivery.js';
import { StudioStore } from './store.js';
import {
  createInjection,
  createWorld,
  injectionPresets,
  type World,
  type WorldContext,
  type WorldEvent,
} from './world.js';

const DAY_MS = 86_400_000;

export class StudioError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'StudioError';
  }
}

export type StudioServiceOptions = {
  dbPath: string;
  model: string;
  modelReady?: boolean;
  clock?: { now(): string };
};

type CallMeta = {
  latencyMs: number;
  source: 'model' | 'preflight';
};

export function createStudioService(options: StudioServiceOptions) {
  const clock = options.clock ?? { now: () => new Date().toISOString() };
  const world: World = createWorld(new Date(clock.now()));
  const store = new StudioStore(options.dbPath);
  const baseSlot = createOpenRouterProactivitySlot({ model: options.model });
  const callMeta = new Map<string, CallMeta>();
  const inFlight = new Map<string, Promise<StudioResult[]>>();
  const runErrors = new Map<string, string>();
  const events = new Map<string, WorldEvent>(world.events.map((event) => [event.id, event]));
  let injectionSequence = 0;

  const slot = {
    evaluate: async (context: GoalContext): Promise<ProactivityDecision> => {
      const deterministic = preflight(context);
      const started = performance.now();
      const decision = await baseSlot.evaluate(context);
      callMeta.set(metaKey(context.trigger.id, context.goal.id), {
        latencyMs: Math.max(1, Math.round(performance.now() - started)),
        source: deterministic ? 'preflight' : 'model',
      });
      return decision;
    },
  };

  const engine = createProactivityEngine({
    goals: { list: () => Promise.resolve(world.goals) },
    contexts: {
      load: (goal, trigger) => {
        const event = events.get(trigger.id);
        if (!event) throw new StudioError(404, `Unknown trigger ${trigger.id}.`);
        const context = event.contexts.find((candidate) => candidate.goalId === goal.id);
        if (!context) {
          throw new StudioError(
            500,
            `No context was assembled for goal ${goal.id} on ${event.id}.`,
          );
        }
        return Promise.resolve(toGoalContext(goal, trigger, event, context));
      },
    },
    slot,
    deliveryPolicy: createStudioDeliveryPolicy({
      store,
      clock,
      ownerFirstName: world.owner.firstName,
    }),
    journal: store.journal,
    clock,
  });

  async function runEvent(eventId: string, force = false): Promise<StudioResult[]> {
    const event = events.get(eventId);
    if (!event) throw new StudioError(404, `Unknown event ${eventId}.`);

    if (!force) {
      const cached = store.getStudioRun(event.id);
      if (cached) return withLivePreferences(cached);
    } else {
      store.deleteRun(event.id);
      store.deleteStudioRun(event.id);
      for (const key of callMeta.keys()) {
        if (key.startsWith(`${event.id}:`)) callMeta.delete(key);
      }
    }

    const existing = inFlight.get(event.id);
    if (existing) return existing;

    const pending = execute(event).finally(() => inFlight.delete(event.id));
    inFlight.set(event.id, pending);
    return pending;
  }

  async function execute(event: WorldEvent): Promise<StudioResult[]> {
    try {
      const run = await engine.run(toTrigger(event, world.owner.id));
      const results = toResults(event, run);
      store.putStudioRun(event.id, results);
      runErrors.delete(event.id);
      return withLivePreferences(results);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The evaluation failed.';
      runErrors.set(event.id, message);
      throw error;
    }
  }

  function toResults(event: WorldEvent, run: EvaluationRun): StudioResult[] {
    return run.evaluations.map((evaluation) => {
      const context = event.contexts.find((candidate) => candidate.goalId === evaluation.goalId);
      const goal = world.goals.find((candidate) => candidate.id === evaluation.goalId);
      if (!context || !goal) {
        throw new StudioError(500, `Evaluation referenced an unknown goal: ${evaluation.goalId}.`);
      }
      const meta = callMeta.get(metaKey(event.id, evaluation.goalId));
      const intent =
        run.deliveryIntents.find(
          (candidate) =>
            candidate.kind === 'goal-proposal' && candidate.goalId === evaluation.goalId,
        ) ?? null;
      return {
        id: resultId(event.id, evaluation.goalId),
        eventId: event.id,
        goalId: evaluation.goalId,
        goalTitle: goal.title,
        decision: evaluation.decision,
        delivery: intent,
        held: false,
        heldUntil: null,
        evidence: context.after,
        previousEvidence: context.before,
        latencyMs: meta?.latencyMs ?? 0,
        source: meta?.source ?? 'cached',
        model: options.model,
        evaluatedAt: evaluation.evaluatedAt,
        expected: context.expected,
        error: null,
      } satisfies StudioResult;
    });
  }

  function withLivePreferences(results: StudioResult[]): StudioResult[] {
    const now = clock.now();
    return results.map((result) => {
      if (result.decision.kind !== 'propose') {
        return { ...result, held: false, heldUntil: null };
      }
      const preference = store.activePreference(result.goalId, now);
      if (!preference) return { ...result, held: false, heldUntil: null };
      return {
        ...result,
        delivery: null,
        held: true,
        heldUntil: preference.until,
      };
    });
  }

  function view(): StudioView {
    const now = clock.now();
    const resultsByEvent = store.listStudioRuns();
    const allResults = [...resultsByEvent.values()]
      .flat()
      .map((result) => withPreference(result, now));
    const actions = store.listActions();
    const actioned = new Set(
      actions
        .filter((action) => action.status === 'open')
        .map((action) => `${action.eventId}:${action.goalId}`),
    );
    const preferences = store.listPreferences(now);

    const studioEvents: StudioEvent[] = [...events.values()]
      .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
      .map((event) => {
        const results = (resultsByEvent.get(event.id) ?? []).map((result) =>
          withPreference(result, now),
        );
        const error = runErrors.get(event.id) ?? null;
        return {
          id: event.id,
          dayIndex: event.dayIndex,
          at: event.at,
          goalIds: event.contexts.map((context) => context.goalId),
          title: event.title,
          summary: event.summary,
          domainLabel: event.domainLabel,
          sourceLabel: event.sourceLabel,
          channelLabel: event.channelLabel,
          status: error ? 'error' : results.length > 0 ? 'done' : 'pending',
          injected: event.injected,
          results,
          error,
        };
      });

    const days: StudioDay[] = world.days.map((date, index) => {
      const dayEvents = studioEvents.filter((event) => event.dayIndex === index);
      const counts = countOutcomes(dayEvents);
      return {
        index,
        date,
        weekday: format(date, { weekday: 'short' }),
        dayNumber: format(date, { day: 'numeric' }),
        month: format(date, { month: 'short' }),
        isStoryDay: index === world.storyDayIndex,
        isPast: index < world.storyDayIndex,
        isFuture: index > world.storyDayIndex,
        counts,
      };
    });

    const goals: StudioGoal[] = world.goals.map((goal) => {
      const latest = latestForGoal(allResults, goal.id, events);
      const latestEvent = latest ? events.get(latest.eventId) : null;
      const preference = preferences.find((candidate) => candidate.goalId === goal.id);
      const accepted = latest ? actioned.has(`${latest.eventId}:${latest.goalId}`) : false;
      return {
        id: goal.id,
        title: goal.title,
        domains: goal.domains,
        status: goal.status,
        state: goalState(latest?.decision.kind, preference, accepted),
        lastCheckedAt: latestEvent?.at ?? null,
      };
    });

    return {
      now: world.storyNow,
      weekLabel: weekLabel(world.days),
      owner: world.owner,
      model: options.model,
      modelReady: options.modelReady ?? Boolean(process.env.OPENROUTER_API_KEY),
      days,
      goals,
      events: studioEvents,
      actions,
      preferences,
      presets: injectionPresets,
      stats: statsFor(allResults),
      storyDayIndex: world.storyDayIndex,
    };

    function withPreference(result: StudioResult, at: string): StudioResult {
      if (result.decision.kind !== 'propose') return result;
      const preference = store.activePreference(result.goalId, at);
      if (!preference) return result;
      return { ...result, delivery: null, held: true, heldUntil: preference.until };
    }
  }

  function setPreference(goalId: string, mode: StudioPreference['mode'], days: number): void {
    assertGoal(goalId);
    const until = new Date(Date.parse(clock.now()) + Math.max(1, days) * DAY_MS).toISOString();
    store.setPreference(goalId, mode, until, clock.now());
  }

  function clearPreference(goalId: string): void {
    assertGoal(goalId);
    store.clearPreference(goalId);
  }

  function accept(resultId: string): StudioAction {
    const [eventId, goalId] = resultId.split(':');
    if (!eventId || !goalId) throw new StudioError(400, 'Malformed result id.');
    const results = store.getStudioRun(eventId);
    const result = results?.find((candidate) => candidate.goalId === goalId);
    if (!result) throw new StudioError(404, 'That decision does not exist.');
    if (result.decision.kind !== 'propose') {
      throw new StudioError(400, 'Only a proposal can be added to the plan.');
    }
    const existing = store
      .listActions()
      .find((action) => action.eventId === eventId && action.goalId === goalId);
    if (existing) return existing;

    assertGoal(goalId);
    return store.addAction({
      goalId,
      eventId,
      title: result.decision.summary,
      nextStep: result.decision.nextStep,
      createdAt: clock.now(),
    });
  }

  function completeAction(id: string, status: StudioAction['status']): void {
    if (status !== 'open' && status !== 'done') {
      throw new StudioError(400, 'Action status must be open or done.');
    }
    store.setActionStatus(id, status);
  }

  function inject(presetId: string): { eventId: string; view: StudioView } {
    if (!injectionPresets.some((preset) => preset.id === presetId)) {
      throw new StudioError(404, `Unknown injection ${presetId}.`);
    }
    injectionSequence += 1;
    const event = createInjection(presetId, world, world.storyNow, injectionSequence);
    if (!event) throw new StudioError(400, 'That injection is not available.');
    events.set(event.id, event);
    return { eventId: event.id, view: view() };
  }

  async function runInjection(presetId: string): Promise<{ eventId: string; view: StudioView }> {
    const injected = inject(presetId);
    await runEvent(injected.eventId);
    return { eventId: injected.eventId, view: view() };
  }

  function reset(): StudioView {
    store.reset();
    callMeta.clear();
    runErrors.clear();
    for (const id of events.keys()) {
      if (events.get(id)?.injected) events.delete(id);
    }
    injectionSequence = 0;
    return view();
  }

  function assertGoal(goalId: string): void {
    if (!world.goals.some((goal) => goal.id === goalId)) {
      throw new StudioError(404, `Unknown goal ${goalId}.`);
    }
  }

  return {
    view,
    runEvent,
    runInjection,
    setPreference,
    clearPreference,
    accept,
    completeAction,
    reset,
    close: () => store.close(),
    model: options.model,
    world,
  };
}

export type StudioService = ReturnType<typeof createStudioService>;

function toTrigger(event: WorldEvent, ownerId: string): ProactivityTrigger {
  return {
    kind: 'critical-change',
    id: event.id,
    ownerId,
    changedDomains: event.changedDomains,
    occurredAt: event.at,
  };
}

function toGoalContext(
  goal: World['goals'][number],
  trigger: ProactivityTrigger,
  event: WorldEvent,
  context: WorldContext,
): GoalContext {
  return {
    goal,
    trigger,
    previous:
      context.before.length > 0
        ? {
            id: `${event.id}-${context.goalId}-before`,
            asOf: newest(context.before),
            evidence: context.before,
          }
        : null,
    current: {
      id: `${event.id}-${context.goalId}-after`,
      asOf: event.at,
      evidence: context.after,
    },
  };
}

function newest(evidence: WorldContext['before']): string {
  return evidence.reduce(
    (latest, item) => (Date.parse(item.observedAt) > Date.parse(latest) ? item.observedAt : latest),
    evidence[0]?.observedAt ?? new Date(0).toISOString(),
  );
}

function metaKey(triggerId: string, goalId: string): string {
  return `${triggerId}:${goalId}`;
}

function resultId(eventId: string, goalId: string): string {
  return `${eventId}:${goalId}`;
}

function countOutcomes(events: StudioEvent[]): StudioDay['counts'] {
  const counts = { propose: 0, defer: 0, quiet: 0, pending: 0 };
  for (const event of events) {
    if (event.results.length === 0) {
      counts.pending += 1;
      continue;
    }
    for (const result of event.results) {
      counts[result.decision.kind] += 1;
    }
  }
  return counts;
}

function latestForGoal(
  results: StudioResult[],
  goalId: string,
  events: Map<string, WorldEvent>,
): StudioResult | null {
  const matching = results
    .filter((result) => result.goalId === goalId)
    .sort(
      (a, b) =>
        Date.parse(events.get(b.eventId)?.at ?? b.evaluatedAt) -
        Date.parse(events.get(a.eventId)?.at ?? a.evaluatedAt),
    );
  return matching[0] ?? null;
}

function goalState(
  kind: DecisionKind | undefined,
  preference: StudioPreference | undefined,
  accepted: boolean,
): StudioGoal['state'] {
  if (!kind) return 'unchecked';
  if (preference) return 'waiting';
  if (accepted) return 'on-track';
  if (kind === 'propose') return 'attention';
  if (kind === 'defer') return 'waiting';
  return 'on-track';
}

function statsFor(results: StudioResult[]): StudioStats {
  const modelResults = results.filter((result) => result.source === 'model');
  const latency = modelResults.reduce((total, result) => total + result.latencyMs, 0);
  return {
    proposals: results.filter((result) => result.decision.kind === 'propose').length,
    deferred: results.filter((result) => result.decision.kind === 'defer').length,
    quiet: results.filter((result) => result.decision.kind === 'quiet').length,
    checks: results.length,
    avoided:
      results.filter((result) => result.decision.kind === 'defer').length +
      results.filter((result) => result.decision.kind === 'quiet').length,
    modelCalls: modelResults.length,
    preflightDefers: results.filter((result) => result.source === 'preflight').length,
    averageLatencyMs: modelResults.length === 0 ? 0 : Math.round(latency / modelResults.length),
  };
}

function weekLabel(days: string[]): string {
  const start = new Date(days[0] ?? new Date());
  const end = new Date(days[days.length - 1] ?? new Date());
  const startMonth = format(start.toISOString(), { month: 'long' });
  const endMonth = format(end.toISOString(), { month: 'long' });
  if (startMonth === endMonth) {
    return `${format(start.toISOString(), { day: 'numeric' })}–${format(end.toISOString(), {
      day: 'numeric',
    })} ${endMonth}`;
  }
  return `${format(start.toISOString(), { day: 'numeric', month: 'short' })} – ${format(
    end.toISOString(),
    { day: 'numeric', month: 'short' },
  )}`;
}

function format(iso: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('en-GB', { ...options, timeZone: 'UTC' }).format(new Date(iso));
}
