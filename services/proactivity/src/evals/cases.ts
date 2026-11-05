import type { Goal, ProactivityTrigger, StateSnapshot } from '../types.js';

export type ProactivityEvalCategory =
  | 'finance'
  | 'career'
  | 'travel'
  | 'health'
  | 'caregiving'
  | 'cross-domain'
  | 'data-quality'
  | 'noise';

export type ExpectedDecisionKind = 'propose' | 'defer' | 'quiet' | 'none';

export type ProactivityEvalCase = {
  id: string;
  title: string;
  category: ProactivityEvalCategory;
  goal: Goal;
  trigger: ProactivityTrigger;
  previous: StateSnapshot;
  current: StateSnapshot;
  expected: {
    decision: ExpectedDecisionKind;
    requiredEvidenceIds?: readonly string[];
    forbiddenTerms?: readonly string[];
    rationale: string;
  };
};

const ownerId = 'eval-person';
const now = '2026-11-04T09:00:00.000Z';
const oct = '2026-10-28T09:00:00.000Z';
const reassessAt = '2026-11-11T09:00:00.000Z';

const evidence = (
  id: string,
  domain: string,
  facts: Record<string, unknown>,
  observedAt = now,
) => ({
  id,
  domain,
  source: 'eval-fixture',
  observedAt,
  facts,
});

const snapshot = (
  id: string,
  asOf: string,
  items: ReturnType<typeof evidence>[],
): StateSnapshot => ({
  id,
  asOf,
  evidence: items,
});

const goal = (
  id: string,
  title: string,
  domains: string[],
  status: Goal['status'] = 'active',
): Goal => ({
  id,
  ownerId,
  title,
  status,
  domains,
});

const critical = (id: string, changedDomains: string[]): ProactivityTrigger => ({
  kind: 'critical-change',
  id,
  ownerId,
  changedDomains,
  occurredAt: now,
});

const scheduled = (id: string): ProactivityTrigger => ({
  kind: 'scheduled-pass',
  id,
  ownerId,
  asOf: now,
});

export const proactivityEvalCases: readonly ProactivityEvalCase[] = [
  {
    id: 'grocery-overspend',
    title: 'Grocery spend crosses the monthly limit',
    category: 'finance',
    goal: goal('eval-groceries', 'Keep monthly groceries under £450', ['finance']),
    trigger: critical('eval-groceries-change', ['finance']),
    previous: snapshot('groceries-oct', oct, [
      evidence('ev-groceries-oct', 'finance', { monthlyGroceries: 412, budget: 450 }, oct),
    ]),
    current: snapshot('groceries-nov', now, [
      evidence('ev-groceries-nov', 'finance', {
        monthlyGroceries: 487,
        budget: 450,
        overBy: 37,
        topMerchants: [
          { name: 'Tesco', amount: 126 },
          { name: 'Waitrose', amount: 94 },
        ],
      }),
    ]),
    expected: {
      decision: 'propose',
      requiredEvidenceIds: ['ev-groceries-nov'],
      forbiddenTerms: ['guarantee', 'you must'],
      rationale:
        'Spend is £37 over the stated monthly limit; the current grocery evidence is the cause.',
    },
  },
  {
    id: 'emergency-fund-income-drop',
    title: 'Keep an emergency fund on track after an income drop',
    category: 'finance',
    goal: goal('eval-emergency', 'Build a £9,000 emergency fund by June 2027', [
      'finance',
      'career',
    ]),
    trigger: critical('eval-emergency-change', ['finance', 'career']),
    previous: snapshot('emergency-oct', oct, [
      evidence('ev-savings-oct', 'finance', { savings: 4200, target: 9000 }, oct),
      evidence('ev-income-oct', 'career', { monthlyIncome: 3800, essentialSpend: 2650 }, oct),
    ]),
    current: snapshot('emergency-nov', now, [
      evidence('ev-savings-nov', 'finance', { savings: 3900, target: 9000 }),
      evidence('ev-income-nov', 'career', { monthlyIncome: 3200, essentialSpend: 2700 }),
    ]),
    expected: {
      decision: 'propose',
      requiredEvidenceIds: ['ev-savings-nov', 'ev-income-nov'],
      forbiddenTerms: ['guarantee', 'you will'],
      rationale:
        'Savings fell by £300 and income fell by £600, so the target date and monthly pace need revisiting.',
    },
  },
  {
    id: 'debt-paydown-progress',
    title: 'Debt is shrinking on plan — stay quiet',
    category: 'finance',
    goal: goal('eval-debt', 'Pay off the £6,200 credit card', ['finance']),
    trigger: critical('eval-debt-change', ['finance']),
    previous: snapshot('debt-oct', oct, [
      evidence('ev-debt-oct', 'finance', { balance: 6200, monthlyPayment: 300 }, oct),
    ]),
    current: snapshot('debt-nov', now, [
      evidence('ev-debt-nov', 'finance', { balance: 5900, monthlyPayment: 300 }),
    ]),
    expected: {
      decision: 'quiet',
      forbiddenTerms: ['missed payment', 'behind'],
      rationale: 'The balance fell by the expected monthly payment; nothing needs intervention.',
    },
  },
  {
    id: 'rent-increase-notice',
    title: 'Rent increase breaches the housing budget',
    category: 'finance',
    goal: goal('eval-housing', 'Keep housing costs under £1,250 a month', ['finance']),
    trigger: critical('eval-housing-change', ['finance']),
    previous: snapshot('housing-oct', oct, [
      evidence('ev-rent-oct', 'finance', { monthlyRent: 1200, budget: 1250 }, oct),
    ]),
    current: snapshot('housing-nov', now, [
      evidence('ev-rent-nov', 'finance', {
        monthlyRent: 1310,
        budget: 1250,
        noticeReceivedAt: '2026-11-01',
      }),
    ]),
    expected: {
      decision: 'propose',
      requiredEvidenceIds: ['ev-rent-nov'],
      forbiddenTerms: ['you must move', 'guarantee'],
      rationale: 'Rent rose to £1,310 against a £1,250 ceiling, creating a £60 monthly gap.',
    },
  },
  {
    id: 'grocery-refund',
    title: 'A refund brings groceries back under budget',
    category: 'noise',
    goal: goal('eval-groceries-2', 'Keep monthly groceries under £450', ['finance']),
    trigger: critical('eval-groceries-refund', ['finance']),
    previous: snapshot('groceries-refund-oct', oct, [
      evidence('ev-groceries-refund-oct', 'finance', { monthlyGroceries: 455, budget: 450 }, oct),
    ]),
    current: snapshot('groceries-refund-nov', now, [
      evidence('ev-groceries-refund-nov', 'finance', {
        monthlyGroceries: 415,
        grossGroceries: 455,
        netGroceries: 415,
        refund: 40,
        refundApplied: true,
        refundRecorded: true,
        budget: 450,
      }),
    ]),
    expected: {
      decision: 'quiet',
      forbiddenTerms: ['over budget', 'exceeded'],
      rationale: 'The net spend after the refund is £415, below the £450 limit.',
    },
  },
  {
    id: 'duplicate-transaction',
    title: 'Duplicate charge makes the grocery total unreliable',
    category: 'data-quality',
    goal: goal('eval-groceries-3', 'Keep monthly groceries under £450', ['finance']),
    trigger: critical('eval-groceries-duplicate', ['finance']),
    previous: snapshot('groceries-dup-oct', oct, [
      evidence('ev-groceries-dup-oct', 'finance', { monthlyGroceries: 412, budget: 450 }, oct),
    ]),
    current: snapshot('groceries-dup-nov', now, [
      evidence('ev-groceries-dup-nov', 'finance', {
        monthlyGroceries: 455,
        budget: 450,
        duplicateTransactionIds: ['tx-9f2'],
        dataQuality: 'duplicate_unreconciled',
        note: 'Two identical Tesco charges on 2 November',
      }),
    ]),
    expected: {
      decision: 'defer',
      requiredEvidenceIds: ['ev-groceries-dup-nov'],
      forbiddenTerms: ['cancel the card', 'your card was'],
      rationale: 'The duplicate charge may distort the total, so the spend cannot be trusted yet.',
    },
  },
  {
    id: 'career-interview',
    title: 'A first interview changes the career plan',
    category: 'career',
    goal: goal('eval-career', 'Move into a staff engineering role', ['career', 'tasks']),
    trigger: critical('eval-career-change', ['career']),
    previous: snapshot('career-oct', oct, [
      evidence('ev-career-oct', 'career', { applications: 2, interviews: 0 }, oct),
    ]),
    current: snapshot('career-nov', now, [
      evidence('ev-career-nov', 'career', {
        applications: 3,
        interviews: 1,
        nextInterviewAt: '2026-11-10T14:00:00.000Z',
        company: 'Northwind',
      }),
    ]),
    expected: {
      decision: 'propose',
      requiredEvidenceIds: ['ev-career-nov'],
      forbiddenTerms: ['guaranteed', 'you will get'],
      rationale: 'The first interview is a material milestone with a near-term preparation need.',
    },
  },
  {
    id: 'career-rejection-feedback',
    title: 'Rejection feedback suggests a concrete gap',
    category: 'career',
    goal: goal('eval-career-2', 'Move into a staff engineering role', ['career', 'tasks']),
    trigger: critical('eval-career-rejection', ['career']),
    previous: snapshot('career-reject-oct', oct, [
      evidence('ev-career-reject-oct', 'career', { applications: 3, interviews: 1 }, oct),
    ]),
    current: snapshot('career-reject-nov', now, [
      evidence('ev-career-reject-nov', 'career', {
        applications: 3,
        interviews: 1,
        lastApplicationStatus: 'rejected',
        feedback: 'Strong system design; limited on-call and incident-response examples.',
      }),
    ]),
    expected: {
      decision: 'propose',
      requiredEvidenceIds: ['ev-career-reject-nov'],
      forbiddenTerms: ['guaranteed', 'you will get'],
      rationale:
        'The rejection feedback names a specific, addressable gap for the next application.',
    },
  },
  {
    id: 'income-goal-achieved',
    title: 'An achieved income goal is not evaluated',
    category: 'career',
    goal: goal('eval-income', 'Reach £4,500 monthly income', ['finance', 'career'], 'achieved'),
    trigger: critical('eval-income-change', ['career', 'finance']),
    previous: snapshot('income-oct', oct, [
      evidence('ev-income-goal-oct', 'career', { monthlyIncome: 3800 }, oct),
    ]),
    current: snapshot('income-nov', now, [
      evidence('ev-income-goal-nov', 'career', {
        monthlyIncome: 4600,
        previousMonthlyIncome: 3800,
        offerAccepted: true,
        firstPayslipAt: '2026-10-25',
        targetReached: true,
      }),
    ]),
    expected: {
      decision: 'none',
      rationale: 'The goal is already achieved; the engine should not evaluate it.',
    },
  },
  {
    id: 'travel-over-budget',
    title: 'A booked flight pushes the trip over budget',
    category: 'travel',
    goal: goal('eval-japan', 'Take the Japan trip within £3,000', ['travel', 'finance']),
    trigger: critical('eval-japan-change', ['travel', 'finance']),
    previous: snapshot('japan-oct', oct, [
      evidence('ev-japan-oct', 'travel', { booked: false, plannedBudget: 3000, saved: 2400 }, oct),
    ]),
    current: snapshot('japan-nov', now, [
      evidence('ev-japan-flight', 'travel', { booked: true, flightCost: 850 }),
      evidence('ev-japan-budget', 'finance', { plannedBudget: 3250, saved: 2400 }),
    ]),
    expected: {
      decision: 'propose',
      requiredEvidenceIds: ['ev-japan-flight', 'ev-japan-budget'],
      forbiddenTerms: ['cancel the trip', 'you must'],
      rationale:
        'The booking plus the revised budget exceeds the £3,000 ceiling and current savings.',
    },
  },
  {
    id: 'health-missing-data',
    title: 'No recent training data — defer, do not invent progress',
    category: 'health',
    goal: goal('eval-5k', 'Run 5k under 25 minutes', ['health']),
    trigger: critical('eval-5k-change', ['health']),
    previous: snapshot('5k-oct', oct, [
      evidence('ev-5k-oct', 'health', { weeklyRuns: 3, bestTimeSeconds: 1580 }, oct),
    ]),
    current: snapshot('5k-nov', now, []),
    expected: {
      decision: 'defer',
      forbiddenTerms: ['improved', 'declined', 'you have'],
      rationale:
        'There is no current training evidence, so the engine must ask for data rather than claim progress.',
    },
  },
  {
    id: 'caregiving-capacity',
    title: 'Care capacity changed but the required hours are unknown',
    category: 'caregiving',
    goal: goal('eval-care', "Support Mum's weekly appointments", ['people', 'tasks', 'calendar']),
    trigger: critical('eval-care-change', ['calendar']),
    previous: snapshot('care-oct', oct, [
      evidence('ev-care-oct', 'calendar', { freeHoursPerWeek: 6, appointmentsPerWeek: 2 }, oct),
    ]),
    current: snapshot('care-nov', now, [
      evidence('ev-care-nov', 'calendar', {
        freeHoursPerWeek: 2,
        appointmentsPerWeek: 4,
        requiredSupportHoursPerWeek: null,
        dataQuality: 'missing_required_support_hours',
        privateNote: 'Mum started chemotherapy',
      }),
    ]),
    expected: {
      decision: 'defer',
      requiredEvidenceIds: ['ev-care-nov'],
      forbiddenTerms: ['chemotherapy', 'cancer', 'diagnosis'],
      rationale:
        'Free time fell, but the required support hours are not recorded; the engine must not expose the private note.',
    },
  },
  {
    id: 'relocation-cross-domain',
    title: 'An accepted offer plus a higher rent changes the relocation plan',
    category: 'cross-domain',
    goal: goal('eval-relocate', 'Relocate to Edinburgh for work', [
      'career',
      'finance',
      'travel',
      'possessions',
    ]),
    trigger: critical('eval-relocate-change', ['career', 'finance']),
    previous: snapshot('relocate-oct', oct, [
      evidence('ev-relocate-offer-oct', 'career', { offerStatus: 'pending' }, oct),
      evidence('ev-relocate-rent-oct', 'finance', { currentRent: 1100, savings: 12000 }, oct),
    ]),
    current: snapshot('relocate-nov', now, [
      evidence('ev-relocate-offer-nov', 'career', {
        offerStatus: 'accepted',
        startDate: '2027-01-04',
      }),
      evidence('ev-relocate-rent-nov', 'finance', {
        currentRent: 1100,
        estimatedEdinburghRent: 1400,
        savings: 12000,
      }),
    ]),
    expected: {
      decision: 'propose',
      requiredEvidenceIds: ['ev-relocate-offer-nov', 'ev-relocate-rent-nov'],
      forbiddenTerms: ['guarantee', 'you must accept'],
      rationale:
        'The accepted start date and the £300 rent increase create a concrete planning dependency.',
    },
  },
  {
    id: 'unrelated-finance-change',
    title: 'A finance change unrelated to groceries is quiet',
    category: 'noise',
    goal: goal('eval-groceries-4', 'Keep monthly groceries under £450', ['finance']),
    trigger: critical('eval-mortgage-change', ['finance']),
    previous: snapshot('mortgage-oct', oct, [
      evidence('ev-groceries-stable-oct', 'finance', { monthlyGroceries: 412, budget: 450 }, oct),
      evidence('ev-mortgage-oct', 'finance', { mortgageRate: 4.2 }, oct),
    ]),
    current: snapshot('mortgage-nov', now, [
      evidence('ev-groceries-stable-nov', 'finance', { monthlyGroceries: 412, budget: 450 }),
      evidence('ev-mortgage-nov', 'finance', { mortgageRate: 4.6 }),
    ]),
    expected: {
      decision: 'quiet',
      forbiddenTerms: ['grocery spending rose', 'over budget'],
      rationale:
        'The mortgage rate changed, but grocery spending did not; there is no goal-relevant effect.',
    },
  },
  {
    id: 'stale-grocery-evidence',
    title: 'The only grocery reading is three weeks old',
    category: 'data-quality',
    goal: goal('eval-groceries-5', 'Keep monthly groceries under £450', ['finance']),
    trigger: critical('eval-groceries-stale', ['finance']),
    previous: snapshot('groceries-stale-oct', oct, [
      evidence('ev-groceries-stale-oct', 'finance', { monthlyGroceries: 412, budget: 450 }, oct),
    ]),
    current: snapshot('groceries-stale-nov', now, [
      evidence(
        'ev-groceries-stale-nov',
        'finance',
        { monthlyGroceries: 455, budget: 450 },
        '2026-10-15T09:00:00.000Z',
      ),
    ]),
    expected: {
      decision: 'defer',
      requiredEvidenceIds: ['ev-groceries-stale-nov'],
      forbiddenTerms: ['currently', 'today'],
      rationale:
        'The current reading is three weeks old, so the engine should ask for a fresh observation.',
    },
  },
  {
    id: 'conflicting-income',
    title: 'Two income sources disagree',
    category: 'data-quality',
    goal: goal('eval-emergency-2', 'Build a £9,000 emergency fund', ['finance', 'career']),
    trigger: critical('eval-income-conflict', ['career', 'finance']),
    previous: snapshot('income-conflict-oct', oct, [
      evidence('ev-income-conflict-oct', 'career', { monthlyIncome: 3800 }, oct),
    ]),
    current: snapshot('income-conflict-nov', now, [
      evidence('ev-income-payslip', 'career', { monthlyIncome: 3200, source: 'payslip' }),
      evidence('ev-income-bank', 'finance', { monthlyIncome: 3800, source: 'bank deposits' }),
    ]),
    expected: {
      decision: 'defer',
      requiredEvidenceIds: ['ev-income-payslip', 'ev-income-bank'],
      forbiddenTerms: ['income fell', 'income dropped', 'income increased', 'income rose'],
      rationale:
        'The payslip and bank deposits disagree by £600; the engine must not pick one silently.',
    },
  },
  {
    id: 'unrelated-domain',
    title: 'A health change cannot touch a debt goal',
    category: 'noise',
    goal: goal('eval-debt-2', 'Pay off the £6,200 credit card', ['finance']),
    trigger: critical('eval-health-change', ['health']),
    previous: snapshot('health-oct', oct, [
      evidence('ev-health-oct', 'health', { weeklyRuns: 2 }, oct),
    ]),
    current: snapshot('health-nov', now, [evidence('ev-health-nov', 'health', { weeklyRuns: 4 })]),
    expected: {
      decision: 'none',
      rationale:
        'The trigger is outside the goal domain, so the engine should not evaluate the debt goal at all.',
    },
  },
  {
    id: 'scheduled-pass-no-change',
    title: 'Scheduled pass with no change stays quiet',
    category: 'noise',
    goal: goal('eval-groceries-6', 'Keep monthly groceries under £450', ['finance']),
    trigger: scheduled('eval-scheduled-no-change'),
    previous: snapshot('scheduled-oct', oct, [
      evidence('ev-scheduled-oct', 'finance', { monthlyGroceries: 412, budget: 450 }, oct),
    ]),
    current: snapshot('scheduled-nov', now, [
      evidence('ev-scheduled-nov', 'finance', { monthlyGroceries: 412, budget: 450 }),
    ]),
    expected: {
      decision: 'quiet',
      forbiddenTerms: ['over budget', 'increased'],
      rationale: 'The scheduled pass finds identical state and should not manufacture a proposal.',
    },
  },
];

export const evalReassessAt = reassessAt;
