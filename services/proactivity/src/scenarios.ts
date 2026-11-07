import type { Goal, ProactivityDecision, ProactivityTrigger, StateSnapshot } from './types.js';

const ownerId = 'synthetic-person';
const beforeDate = '2026-10-26T09:00:00.000Z';
const afterDate = '2026-11-02T09:00:00.000Z';
const occurredAt = '2026-11-02T09:05:00.000Z';

export type GoalScenario = {
  id: string;
  goal: Goal;
  trigger: ProactivityTrigger;
  previous: StateSnapshot;
  current: StateSnapshot;
  expectedDecision: ProactivityDecision;
};

function evidence(id: string, domain: string, facts: Record<string, unknown>) {
  return { id, domain, source: 'synthetic-fixture', observedAt: afterDate, facts };
}

function snapshot(
  id: string,
  asOf: string,
  evidenceItems: ReturnType<typeof evidence>[],
): StateSnapshot {
  return { id, asOf, evidence: evidenceItems.map((item) => ({ ...item, observedAt: asOf })) };
}

function scenario(input: {
  id: string;
  title: string;
  domains: string[];
  changedDomain: string;
  before: ReturnType<typeof evidence>[];
  after: ReturnType<typeof evidence>[];
  expectedDecision: ProactivityDecision;
}): GoalScenario {
  const goal: Goal = {
    id: input.id,
    ownerId,
    title: input.title,
    status: 'active',
    domains: input.domains,
  };
  return {
    id: input.id,
    goal,
    trigger: {
      kind: 'critical-change',
      id: `${input.id}-change`,
      ownerId,
      changedDomains: [input.changedDomain],
      occurredAt,
    },
    previous: snapshot(`${input.id}-before`, beforeDate, input.before),
    current: snapshot(`${input.id}-after`, afterDate, input.after),
    expectedDecision: input.expectedDecision,
  };
}

const propose = (input: {
  summary: string;
  reason: string;
  nextStep: string;
  evidenceIds: string[];
}): ProactivityDecision => ({ kind: 'propose', ...input });

const defer = (reason: string, evidenceIds: string[]): ProactivityDecision => ({
  kind: 'defer',
  reason,
  reevaluateAt: '2026-11-09T09:00:00.000Z',
  evidenceIds,
});

const quiet = (reason: string, evidenceIds: string[] = []): ProactivityDecision => ({
  kind: 'quiet',
  reason,
  evidenceIds,
});

export const goalScenarios: GoalScenario[] = [
  scenario({
    id: 'emergency-fund',
    title: 'Build an emergency fund',
    domains: ['finance', 'career', 'tasks'],
    changedDomain: 'finance',
    before: [
      evidence('emergency-before-cash', 'finance', { savings: 4200, target: 9000 }),
      evidence('emergency-before-income', 'career', { monthlyIncome: 3800 }),
    ],
    after: [
      evidence('emergency-cash', 'finance', { savings: 3900, target: 9000, monthlySpend: 3400 }),
      evidence('emergency-income', 'career', { monthlyIncome: 3200 }),
      evidence('emergency-task', 'tasks', { title: 'Review monthly budget', status: 'open' }),
    ],
    expectedDecision: propose({
      summary: 'The savings target may take longer to reach.',
      reason: 'Savings fell while reported income also decreased.',
      nextStep: 'Review the savings pace and target date.',
      evidenceIds: ['emergency-cash', 'emergency-income'],
    }),
  }),
  scenario({
    id: 'pay-off-debt',
    title: 'Pay off debt',
    domains: ['finance', 'tasks'],
    changedDomain: 'finance',
    before: [evidence('debt-before', 'finance', { balance: 6200, payment: 300 })],
    after: [evidence('debt-after', 'finance', { balance: 5900, payment: 300 })],
    expectedDecision: quiet('The recorded balance moved toward the goal.', ['debt-after']),
  }),
  scenario({
    id: 'home-purchase',
    title: 'Save for a home purchase',
    domains: ['finance', 'career', 'tasks'],
    changedDomain: 'career',
    before: [
      evidence('home-before-savings', 'finance', { deposit: 18000, target: 30000 }),
      evidence('home-before-income', 'career', { monthlyIncome: 4500 }),
    ],
    after: [
      evidence('home-savings', 'finance', { deposit: 18000, target: 30000 }),
      evidence('home-income', 'career', { monthlyIncome: 3900, status: 'reduced-hours' }),
    ],
    expectedDecision: propose({
      summary: 'The deposit timeline may have shifted.',
      reason: 'The target is unchanged and reported monthly income is lower.',
      nextStep: 'Revisit the target date using current income and expenses.',
      evidenceIds: ['home-savings', 'home-income'],
    }),
  }),
  scenario({
    id: 'career-change',
    title: 'Change careers',
    domains: ['career', 'finance', 'tasks'],
    changedDomain: 'career',
    before: [evidence('career-before', 'career', { applications: 2, interviews: 0 })],
    after: [
      evidence('career-progress', 'career', { applications: 3, interviews: 1 }),
      evidence('career-runway', 'finance', { availableSavings: 8400 }),
      evidence('career-task', 'tasks', { title: 'Prepare interview examples', status: 'open' }),
    ],
    expectedDecision: propose({
      summary: 'An interview is now part of the career-change plan.',
      reason: 'The application count and interview count changed.',
      nextStep: 'Prepare examples for the interview.',
      evidenceIds: ['career-progress', 'career-task'],
    }),
  }),
  scenario({
    id: 'career-growth',
    title: 'Grow in current work',
    domains: ['career', 'tasks'],
    changedDomain: 'career',
    before: [evidence('growth-before', 'career', { worklogEntries: 2, skills: ['planning'] })],
    after: [
      evidence('growth-worklog', 'career', {
        worklogEntries: 5,
        skills: ['planning', 'mentoring'],
      }),
      evidence('growth-task', 'tasks', { title: 'Collect project outcomes', status: 'open' }),
    ],
    expectedDecision: propose({
      summary: 'Your recent worklog adds evidence of growth.',
      reason: 'New work records include mentoring alongside planning.',
      nextStep: 'Collect outcomes that show the impact of this work.',
      evidenceIds: ['growth-worklog', 'growth-task'],
    }),
  }),
  scenario({
    id: 'start-business',
    title: 'Start a business',
    domains: ['career', 'finance', 'tasks'],
    changedDomain: 'finance',
    before: [
      evidence('business-before-runway', 'finance', { availableSavings: 18000 }),
      evidence('business-before-plan', 'tasks', { milestones: 4, complete: 2 }),
    ],
    after: [
      evidence('business-runway', 'finance', { availableSavings: 9200 }),
      evidence('business-plan', 'tasks', { milestones: 4, complete: 2 }),
      evidence('business-project', 'career', { projectStatus: 'active' }),
    ],
    expectedDecision: defer(
      'Current evidence does not establish the business launch costs or runway need.',
      ['business-runway', 'business-project'],
    ),
  }),
  scenario({
    id: 'health-fitness',
    title: 'Improve health or fitness',
    domains: ['health', 'tasks'],
    changedDomain: 'health',
    before: [evidence('health-before', 'health', { weeklySessions: 2, observedWeeks: 3 })],
    after: [evidence('health-current', 'health', { weeklySessions: 2, observedWeeks: 3 })],
    expectedDecision: quiet('The new observation does not show a meaningful change.', [
      'health-current',
    ]),
  }),
  scenario({
    id: 'major-trip',
    title: 'Take a major trip',
    domains: ['travel', 'finance', 'tasks'],
    changedDomain: 'finance',
    before: [
      evidence('trip-before-budget', 'finance', { plannedBudget: 2400, saved: 1900 }),
      evidence('trip-before-plan', 'travel', { booked: false }),
    ],
    after: [
      evidence('trip-budget', 'finance', { plannedBudget: 2800, saved: 1900 }),
      evidence('trip-booking', 'travel', { booked: true, cost: 800 }),
    ],
    expectedDecision: propose({
      summary: 'The trip cost now exceeds the current savings amount.',
      reason: 'The planned budget increased and a booking was recorded.',
      nextStep: 'Review the remaining trip budget before adding expenses.',
      evidenceIds: ['trip-budget', 'trip-booking'],
    }),
  }),
  scenario({
    id: 'relocation',
    title: 'Relocate to a new city',
    domains: ['career', 'finance', 'travel', 'possessions', 'tasks'],
    changedDomain: 'career',
    before: [
      evidence('move-before-offer', 'career', { offerStatus: 'pending' }),
      evidence('move-before-runway', 'finance', { availableSavings: 12000 }),
    ],
    after: [
      evidence('move-offer', 'career', { offerStatus: 'accepted', startDate: '2027-01-04' }),
      evidence('move-runway', 'finance', { availableSavings: 12000 }),
      evidence('move-task', 'tasks', { title: 'Plan relocation', status: 'open' }),
    ],
    expectedDecision: propose({
      summary: 'The accepted offer gives the relocation plan a start date.',
      reason: 'The offer status changed and relocation preparation remains open.',
      nextStep: 'Add the move and start-date dependencies to the plan.',
      evidenceIds: ['move-offer', 'move-task'],
    }),
  }),
  scenario({
    id: 'caregiving',
    title: 'Support a family member',
    domains: ['people', 'tasks', 'calendar', 'finance'],
    changedDomain: 'calendar',
    before: [
      evidence('care-before-commitment', 'people', { commitment: 'weekly visit' }),
      evidence('care-before-time', 'calendar', { weeklyFreeHours: 6 }),
    ],
    after: [
      evidence('care-commitment', 'people', { commitment: 'weekly visit' }),
      evidence('care-time', 'calendar', { weeklyFreeHours: 2 }),
      evidence('care-task', 'tasks', { title: 'Coordinate support', status: 'open' }),
    ],
    expectedDecision: defer(
      'The available time changed, but the required support time is not recorded.',
      ['care-time', 'care-task'],
    ),
  }),
];
