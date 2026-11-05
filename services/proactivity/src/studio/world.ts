import type { Evidence, Goal } from '../types.js';
import type { DecisionKind, StudioOwner } from './contract.js';

const DAY_MS = 86_400_000;

export const OWNER: StudioOwner = {
  id: 'maya',
  name: 'Maya Chen',
  firstName: 'Maya',
  initials: 'MC',
  email: 'maya@hominem.app',
};

export type WorldContext = {
  goalId: string;
  expected: DecisionKind | null;
  before: Evidence[];
  after: Evidence[];
};

export type WorldEvent = {
  id: string;
  dayIndex: number;
  at: string;
  title: string;
  summary: string;
  domainLabel: string;
  sourceLabel: string;
  channelLabel: string;
  changedDomains: string[];
  injected: boolean;
  contexts: WorldContext[];
};

export type World = {
  owner: StudioOwner;
  weekStart: string;
  storyNow: string;
  storyDayIndex: number;
  days: string[];
  goals: Goal[];
  events: WorldEvent[];
};

type Facts = Record<string, unknown>;

function isoAt(weekStart: Date, dayIndex: number, hour: number, minute = 0): string {
  return new Date(
    weekStart.getTime() + dayIndex * DAY_MS + (hour * 60 + minute) * 60_000,
  ).toISOString();
}

function daysBefore(iso: string, days: number): string {
  return new Date(Date.parse(iso) - days * DAY_MS).toISOString();
}

function fact(
  id: string,
  domain: string,
  source: string,
  observedAt: string,
  facts: Facts,
): Evidence {
  const moneyDomain = domain === 'finance' || domain === 'housing' || domain === 'travel';
  return {
    id,
    domain,
    source,
    observedAt,
    facts: moneyDomain ? { currency: 'GBP', ...facts } : facts,
  };
}

export function mondayOf(now: Date): Date {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = start.getUTCDay();
  start.setUTCDate(start.getUTCDate() + (day === 0 ? -6 : 1 - day));
  return start;
}

export function createWorld(now = new Date()): World {
  const weekStart = mondayOf(now);
  const day = (index: number, hour: number, minute = 0) => isoAt(weekStart, index, hour, minute);

  const groceryAt = day(0, 7, 40);
  const cardAt = day(0, 18, 20);
  const duplicateAt = day(1, 8, 10);
  const interviewAt = day(1, 14, 30);
  const healthAt = day(2, 7, 0);
  const rentAt = day(2, 16, 45);
  const incomeAt = day(3, 9, 0);
  const careAt = day(3, 13, 40);
  const feedbackAt = day(3, 16, 20);
  const holidayAt = day(4, 10, 0);

  const goals: Goal[] = [
    {
      id: 'budget',
      ownerId: OWNER.id,
      title: 'Stay inside the monthly plan',
      status: 'active',
      domains: ['finance.budget'],
    },
    {
      id: 'emergency',
      ownerId: OWNER.id,
      title: 'Build a three-month cushion',
      status: 'active',
      domains: ['finance.savings'],
    },
    {
      id: 'career',
      ownerId: OWNER.id,
      title: 'Find a better role',
      status: 'active',
      domains: ['career.search'],
    },
    {
      id: 'health',
      ownerId: OWNER.id,
      title: 'Run a half marathon',
      status: 'active',
      domains: ['health.training'],
    },
    {
      id: 'care',
      ownerId: OWNER.id,
      title: 'Look after Dad without burning out',
      status: 'active',
      domains: ['care.capacity'],
    },
    {
      id: 'move',
      ownerId: OWNER.id,
      title: 'Move to Bristol in spring',
      status: 'active',
      domains: ['housing.move', 'finance.savings'],
    },
    {
      id: 'holiday',
      ownerId: OWNER.id,
      title: 'Take a proper holiday',
      status: 'active',
      domains: ['travel.holiday'],
    },
  ];

  const events: WorldEvent[] = [
    {
      id: 'grocery-sync',
      dayIndex: 0,
      at: groceryAt,
      title: 'Grocery spending clears £450',
      summary: 'The weekly supermarket sync lands £37 above the November plan.',
      domainLabel: 'Money',
      sourceLabel: 'Monzo',
      channelLabel: 'Bank sync',
      changedDomains: ['finance.budget'],
      injected: false,
      contexts: [
        {
          goalId: 'budget',
          expected: 'propose',
          before: [
            fact('grocery-before', 'finance', 'Monzo', daysBefore(groceryAt, 7), {
              month: 'November',
              monthlyGroceries: 412,
              groceryBudget: 450,
              daysLeft: 24,
              account: 'Everyday',
            }),
          ],
          after: [
            fact('grocery-after', 'finance', 'Monzo', groceryAt, {
              month: 'November',
              monthlyGroceries: 487,
              groceryBudget: 450,
              overBy: 37,
              daysLeft: 23,
              account: 'Everyday',
              topMerchants: [
                { name: 'Tesco', amount: 126 },
                { name: 'Waitrose', amount: 94 },
                { name: "Sainsbury's", amount: 71 },
              ],
            }),
          ],
        },
      ],
    },
    {
      id: 'card-payment',
      dayIndex: 0,
      at: cardAt,
      title: 'Card payment lands on plan',
      summary: 'The monthly payment cleared; the balance is still tracking to target.',
      domainLabel: 'Money',
      sourceLabel: 'Amex',
      channelLabel: 'Card sync',
      changedDomains: ['finance.budget'],
      injected: false,
      contexts: [
        {
          goalId: 'budget',
          expected: 'quiet',
          before: [
            fact('card-before', 'finance', 'Amex', daysBefore(cardAt, 7), {
              cardBalance: 3050,
              monthlyPayment: 210,
              planTarget: 2600,
              monthsRemaining: 8,
              onPlan: true,
            }),
          ],
          after: [
            fact('card-after', 'finance', 'Amex', cardAt, {
              cardBalance: 2840,
              monthlyPayment: 210,
              planTarget: 2600,
              monthsRemaining: 7,
              onPlan: true,
              lastPaymentAt: cardAt,
            }),
          ],
        },
      ],
    },
    {
      id: 'duplicate-charge',
      dayIndex: 1,
      at: duplicateAt,
      title: 'A Tesco charge appears twice',
      summary:
        'Two identical £84.20 charges on consecutive days; the ledger cannot reconcile them yet.',
      domainLabel: 'Money',
      sourceLabel: 'Monzo',
      channelLabel: 'Bank sync',
      changedDomains: ['finance.budget'],
      injected: false,
      contexts: [
        {
          goalId: 'budget',
          expected: 'defer',
          before: [
            fact('duplicate-before', 'finance', 'Monzo', daysBefore(duplicateAt, 1), {
              month: 'November',
              monthlyGroceries: 487,
              groceryBudget: 450,
            }),
          ],
          after: [
            fact('duplicate-after', 'finance', 'Monzo', duplicateAt, {
              month: 'November',
              monthlyGroceries: 571,
              groceryBudget: 450,
              duplicateCharge: {
                merchant: 'Tesco',
                amount: 84.2,
                dates: [daysBefore(duplicateAt, 1), duplicateAt],
              },
              dataQuality: 'duplicate_unreconciled',
            }),
          ],
        },
      ],
    },
    {
      id: 'interview-invite',
      dayIndex: 1,
      at: interviewAt,
      title: 'Northwind books a technical interview',
      summary: 'A 60-minute systems interview is booked for Thursday afternoon.',
      domainLabel: 'Career',
      sourceLabel: 'Gmail',
      channelLabel: 'Calendar + inbox',
      changedDomains: ['career.search'],
      injected: false,
      contexts: [
        {
          goalId: 'career',
          expected: 'propose',
          before: [
            fact('interview-before', 'career', 'Gmail', daysBefore(interviewAt, 6), {
              applications: 4,
              interviews: 0,
              lastApplicationAt: daysBefore(interviewAt, 12),
              searchStartedAt: daysBefore(interviewAt, 38),
            }),
          ],
          after: [
            fact('interview-after', 'career', 'Gmail', interviewAt, {
              applications: 4,
              interviews: 1,
              interview: {
                company: 'Northwind',
                role: 'Staff Engineer',
                stage: 'technical',
                format: 'video',
                at: day(3, 13, 0),
                durationMinutes: 60,
              },
              prep: {
                completedSessions: 0,
                focusAreas: ['system design', 'company research'],
              },
              jobSpec: {
                mustHaves: ['distributed systems', 'technical leadership'],
                topics: ['caching', 'failure modes', 'event-driven design'],
              },
            }),
          ],
        },
      ],
    },
    {
      id: 'health-gap',
      dayIndex: 2,
      at: healthAt,
      title: 'Training data goes quiet',
      summary:
        'No runs have synced for nine days, and the watch has not uploaded the last three sessions.',
      domainLabel: 'Health',
      sourceLabel: 'Apple Health',
      channelLabel: 'Watch sync',
      changedDomains: ['health.training'],
      injected: false,
      contexts: [
        {
          goalId: 'health',
          expected: 'defer',
          before: [
            fact('health-before', 'health', 'Apple Health', daysBefore(healthAt, 7), {
              plannedRuns: 3,
              completedRuns: 2,
              lastRunAt: daysBefore(healthAt, 2),
              restingHeartRate: 56,
              source: 'watch',
            }),
          ],
          after: [
            fact('health-after', 'health', 'Apple Health', healthAt, {
              plannedRuns: 3,
              completedRuns: 0,
              lastRunAt: daysBefore(healthAt, 9),
              restingHeartRate: 58,
              source: 'watch',
              dataQuality: 'missing_current_measurements',
            }),
          ],
        },
      ],
    },
    {
      id: 'rent-renewal',
      dayIndex: 2,
      at: rentAt,
      title: 'The rent renewal arrives at +£120',
      summary:
        'The landlord proposes £1,600 from January. Salary data has not been confirmed this month.',
      domainLabel: 'Home',
      sourceLabel: 'Landlord email',
      channelLabel: 'Inbox',
      changedDomains: ['finance.budget', 'housing.move'],
      injected: false,
      contexts: [
        {
          goalId: 'budget',
          expected: 'propose',
          before: [
            fact('rent-budget-before', 'finance', 'Monzo', daysBefore(rentAt, 7), {
              month: 'November',
              rent: 1480,
              groceryBudget: 450,
              monthlyNetIncome: 3120,
            }),
          ],
          after: [
            fact('rent-budget-after', 'finance', 'Landlord email', rentAt, {
              month: 'November',
              rent: 1480,
              proposedRent: 1600,
              proposedEffective: day(61, 0),
              monthlyIncrease: 120,
              groceryBudget: 450,
              monthlyNetIncome: 3120,
              noticeReceivedAt: rentAt,
            }),
          ],
        },
        {
          goalId: 'move',
          expected: 'defer',
          before: [
            fact('rent-move-before', 'housing', 'Landlord email', daysBefore(rentAt, 7), {
              currentRent: 1480,
              targetCity: 'Bristol',
              targetMoveDate: day(152, 0),
              savings: 2400,
            }),
            fact('rent-move-salary-old', 'finance', 'Payslip', daysBefore(rentAt, 12), {
              monthlyNetIncome: 3500,
              dataQuality: 'stale',
              note: 'Last confirmed before overtime ended',
            }),
          ],
          after: [
            fact('rent-move-after', 'housing', 'Landlord email', rentAt, {
              currentRent: 1480,
              proposedRent: 1600,
              targetCity: 'Bristol',
              targetMoveDate: day(152, 0),
              savings: 2400,
            }),
            fact('rent-move-salary', 'finance', 'Payslip', daysBefore(rentAt, 12), {
              monthlyNetIncome: 3500,
              dataQuality: 'stale',
              note: 'Last confirmed before overtime ended',
            }),
          ],
        },
      ],
    },
    {
      id: 'overtime-ends',
      dayIndex: 3,
      at: incomeAt,
      title: 'Overtime disappears from the payslip',
      summary:
        'Net income settles at £3,120, £380 below the figure the move and cushion plans were built on.',
      domainLabel: 'Money',
      sourceLabel: 'Payslip',
      channelLabel: 'Payroll',
      changedDomains: ['finance.savings'],
      injected: false,
      contexts: [
        {
          goalId: 'emergency',
          expected: 'propose',
          before: [
            fact('income-emergency-before', 'finance', 'Payslip', daysBefore(incomeAt, 30), {
              savingsBalance: 2400,
              target: 9000,
              monthlyContribution: 250,
              monthlyNetIncome: 3500,
              monthsToTarget: 26,
            }),
          ],
          after: [
            fact('income-emergency-after', 'finance', 'Payslip', incomeAt, {
              savingsBalance: 2400,
              target: 9000,
              monthlyContribution: 250,
              monthlyNetIncome: 3120,
              incomeChange: -380,
              changeReason: 'overtime ended',
              monthsToTarget: 34,
            }),
          ],
        },
        {
          goalId: 'move',
          expected: 'propose',
          before: [
            fact(
              'income-move-before-housing',
              'housing',
              'Landlord email',
              daysBefore(incomeAt, 1),
              {
                currentRent: 1480,
                proposedRent: 1600,
                targetCity: 'Bristol',
                targetMoveDate: day(152, 0),
                savings: 2400,
              },
            ),
            fact('income-move-before-salary', 'finance', 'Payslip', daysBefore(incomeAt, 12), {
              monthlyNetIncome: 3500,
              dataQuality: 'stale',
            }),
          ],
          after: [
            fact(
              'income-move-after-housing',
              'housing',
              'Landlord email',
              daysBefore(incomeAt, 1),
              {
                currentRent: 1480,
                proposedRent: 1600,
                targetCity: 'Bristol',
                targetMoveDate: day(152, 0),
                savings: 2400,
              },
            ),
            fact('income-move-after-salary', 'finance', 'Payslip', incomeAt, {
              monthlyNetIncome: 3120,
              incomeChange: -380,
              changeReason: 'overtime ended',
              confirmedAt: incomeAt,
            }),
          ],
        },
      ],
    },
    {
      id: 'care-hours',
      dayIndex: 3,
      at: careAt,
      title: "Dad's care needs rise to 18 hours",
      summary: 'The care assessment changed, but the support rota has not been confirmed.',
      domainLabel: 'Care',
      sourceLabel: 'Care agency',
      channelLabel: 'Assessment',
      changedDomains: ['care.capacity'],
      injected: false,
      contexts: [
        {
          goalId: 'care',
          expected: 'defer',
          before: [
            fact('care-before', 'care', 'Care agency', daysBefore(careAt, 14), {
              requiredHoursPerWeek: 16,
              availableHoursPerWeek: 13,
              supportOptions: ['sibling rota', 'respite care'],
            }),
          ],
          after: [
            fact('care-after', 'care', 'Care agency', careAt, {
              requiredHoursPerWeek: 18,
              availableHoursPerWeek: 11,
              shortfallHours: 7,
              supportOptions: ['sibling rota', 'respite care'],
              dataQuality: 'missing_required_support_hours',
            }),
          ],
        },
      ],
    },
    {
      id: 'interview-feedback',
      dayIndex: 3,
      at: feedbackAt,
      title: 'Northwind passes, with useful feedback',
      summary: 'The rejection names system design as the gap: caching and failure modes.',
      domainLabel: 'Career',
      sourceLabel: 'Gmail',
      channelLabel: 'Inbox',
      changedDomains: ['career.search'],
      injected: false,
      contexts: [
        {
          goalId: 'career',
          expected: 'propose',
          before: [
            fact('feedback-before', 'career', 'Gmail', daysBefore(feedbackAt, 1), {
              interviews: 1,
              interview: {
                company: 'Northwind',
                role: 'Staff Engineer',
                stage: 'technical',
                at: day(3, 13, 0),
              },
              prep: { completedSessions: 2 },
            }),
          ],
          after: [
            fact('feedback-after', 'career', 'Gmail', feedbackAt, {
              interviews: 1,
              application: {
                company: 'Northwind',
                role: 'Staff Engineer',
                outcome: 'rejected',
                stage: 'technical',
                feedback:
                  'Strong product sense. System design was thin on caching and failure modes.',
              },
              skills: {
                systemDesign: 'developing',
                leadership: 'strong',
              },
              nextApplications: 0,
            }),
          ],
        },
      ],
    },
    {
      id: 'holiday-deposit',
      dayIndex: 4,
      at: holidayAt,
      title: 'The Lisbon deposit is due today',
      summary: 'The held booking needs £420, taking the trip £240 past its envelope.',
      domainLabel: 'Travel',
      sourceLabel: 'Booking',
      channelLabel: 'Reservation',
      changedDomains: ['travel.holiday'],
      injected: false,
      contexts: [
        {
          goalId: 'holiday',
          expected: 'propose',
          before: [
            fact('holiday-before', 'travel', 'Booking', daysBefore(holidayAt, 10), {
              destination: 'Lisbon',
              budget: 1800,
              committed: 1200,
              nights: 5,
            }),
          ],
          after: [
            fact('holiday-after', 'travel', 'Booking', holidayAt, {
              destination: 'Lisbon',
              budget: 1800,
              committed: 1620,
              nights: 5,
              deposit: { amount: 420, dueAt: day(4, 16, 0) },
              remainingAfterDeposit: 180,
              overBy: 240,
            }),
          ],
        },
      ],
    },
  ];

  return {
    owner: OWNER,
    weekStart: weekStart.toISOString(),
    storyNow: isoAt(weekStart, 3, 17, 10),
    storyDayIndex: 3,
    days: Array.from({ length: 7 }, (_, index) =>
      new Date(weekStart.getTime() + index * DAY_MS).toISOString(),
    ),
    goals,
    events,
  };
}

export type InjectionPreset = {
  id: string;
  label: string;
  hint: string;
};

export const injectionPresets: InjectionPreset[] = [
  {
    id: 'income-drop',
    label: 'Income drops £400',
    hint: 'Cushion and Bristol plan',
  },
  {
    id: 'bonus',
    label: 'A £1,500 bonus lands',
    hint: 'Cushion',
  },
  {
    id: 'rent-shock',
    label: 'Rent rises another £180',
    hint: 'Budget and Bristol plan',
  },
  {
    id: 'health-sync',
    label: 'Three runs appear',
    hint: 'Half marathon',
  },
  {
    id: 'duplicate-clears',
    label: 'Duplicate charge clears',
    hint: 'Monthly plan',
  },
];

export function createInjection(
  presetId: string,
  world: World,
  now: string,
  sequence: number,
): WorldEvent | null {
  const at = now;
  const id = `inject-${presetId}-${sequence}`;
  const context = (goalId: string, before: Evidence[], after: Evidence[]): WorldContext => ({
    goalId,
    expected: null,
    before,
    after,
  });

  switch (presetId) {
    case 'income-drop':
      return {
        id,
        dayIndex: world.storyDayIndex,
        at,
        title: 'Income drops another £400',
        summary: 'A hypothetical second income shock, to see whether the plan still holds.',
        domainLabel: 'What if',
        sourceLabel: 'Injected',
        channelLabel: 'Payslip',
        changedDomains: ['finance.savings'],
        injected: true,
        contexts: [
          context(
            'emergency',
            [
              fact(`${id}-emergency-before`, 'finance', 'Payslip', at, {
                savingsBalance: 2400,
                target: 9000,
                monthlyContribution: 250,
                monthlyNetIncome: 3120,
                monthsToTarget: 34,
              }),
            ],
            [
              fact(`${id}-emergency-after`, 'finance', 'Payslip', at, {
                savingsBalance: 2400,
                target: 9000,
                monthlyContribution: 250,
                monthlyNetIncome: 2720,
                incomeChange: -400,
                changeReason: 'second income shock',
                monthsToTarget: 47,
              }),
            ],
          ),
          context(
            'move',
            [
              fact(`${id}-move-before`, 'finance', 'Payslip', at, {
                monthlyNetIncome: 3120,
                currentRent: 1600,
                targetCity: 'Bristol',
                targetMoveDate: new Date(Date.parse(world.weekStart) + 152 * DAY_MS).toISOString(),
                savings: 2400,
              }),
            ],
            [
              fact(`${id}-move-after`, 'finance', 'Payslip', at, {
                monthlyNetIncome: 2720,
                incomeChange: -400,
                currentRent: 1600,
                targetCity: 'Bristol',
                targetMoveDate: new Date(Date.parse(world.weekStart) + 152 * DAY_MS).toISOString(),
                savings: 2400,
              }),
            ],
          ),
        ],
      };
    case 'bonus':
      return {
        id,
        dayIndex: world.storyDayIndex,
        at,
        title: 'A £1,500 bonus lands',
        summary:
          'A one-off payment arrives. It could shorten the cushion, or disappear into the month.',
        domainLabel: 'What if',
        sourceLabel: 'Injected',
        channelLabel: 'Payslip',
        changedDomains: ['finance.savings'],
        injected: true,
        contexts: [
          context(
            'emergency',
            [
              fact(`${id}-emergency-before`, 'finance', 'Payslip', at, {
                savingsBalance: 2400,
                target: 9000,
                monthlyContribution: 250,
                monthlyNetIncome: 3120,
              }),
            ],
            [
              fact(`${id}-emergency-after`, 'finance', 'Payslip', at, {
                savingsBalance: 3900,
                target: 9000,
                monthlyContribution: 250,
                monthlyNetIncome: 3120,
                oneOffBonus: 1500,
              }),
            ],
          ),
          context(
            'move',
            [
              fact(`${id}-move-before`, 'finance', 'Payslip', at, {
                savings: 2400,
                monthlyNetIncome: 3120,
                currentRent: 1600,
                targetCity: 'Bristol',
              }),
            ],
            [
              fact(`${id}-move-after`, 'finance', 'Payslip', at, {
                savings: 3900,
                monthlyNetIncome: 3120,
                currentRent: 1600,
                targetCity: 'Bristol',
                oneOffBonus: 1500,
              }),
            ],
          ),
        ],
      };
    case 'rent-shock':
      return {
        id,
        dayIndex: world.storyDayIndex,
        at,
        title: 'Rent rises another £180',
        summary:
          'The renewal moves again. The budget and the Bristol plan both read the same number.',
        domainLabel: 'What if',
        sourceLabel: 'Injected',
        channelLabel: 'Landlord email',
        changedDomains: ['finance.budget', 'housing.move'],
        injected: true,
        contexts: [
          context(
            'budget',
            [
              fact(`${id}-budget-before`, 'finance', 'Landlord email', at, {
                month: 'November',
                rent: 1600,
                proposedRent: 1600,
                groceryBudget: 450,
                monthlyNetIncome: 3120,
              }),
            ],
            [
              fact(`${id}-budget-after`, 'finance', 'Landlord email', at, {
                month: 'November',
                rent: 1600,
                proposedRent: 1780,
                monthlyIncrease: 180,
                groceryBudget: 450,
                monthlyNetIncome: 3120,
              }),
            ],
          ),
          context(
            'move',
            [
              fact(`${id}-move-before`, 'housing', 'Landlord email', at, {
                currentRent: 1600,
                targetCity: 'Bristol',
                savings: 2400,
                monthlyNetIncome: 3120,
              }),
            ],
            [
              fact(`${id}-move-after`, 'housing', 'Landlord email', at, {
                currentRent: 1600,
                proposedRent: 1780,
                targetCity: 'Bristol',
                savings: 2400,
                monthlyNetIncome: 3120,
              }),
            ],
          ),
        ],
      };
    case 'health-sync':
      return {
        id,
        dayIndex: world.storyDayIndex,
        at,
        title: 'Three runs appear in Health',
        summary:
          'The watch finally uploads the missing sessions. The training picture is current again.',
        domainLabel: 'What if',
        sourceLabel: 'Injected',
        channelLabel: 'Watch sync',
        changedDomains: ['health.training'],
        injected: true,
        contexts: [
          context(
            'health',
            [
              fact(`${id}-health-before`, 'health', 'Apple Health', at, {
                plannedRuns: 3,
                completedRuns: 0,
                lastRunAt: new Date(Date.parse(at) - 9 * DAY_MS).toISOString(),
                restingHeartRate: 58,
                dataQuality: 'missing_current_measurements',
              }),
            ],
            [
              fact(`${id}-health-after`, 'health', 'Apple Health', at, {
                plannedRuns: 3,
                completedRuns: 3,
                lastRunAt: new Date(Date.parse(at) - 1 * DAY_MS).toISOString(),
                restingHeartRate: 57,
                weeklyDistanceKm: 24.6,
                source: 'watch',
              }),
            ],
          ),
        ],
      };
    case 'duplicate-clears':
      return {
        id,
        dayIndex: world.storyDayIndex,
        at,
        title: 'The duplicate charge clears',
        summary: 'The bank reverses the second Tesco charge. The month is readable again.',
        domainLabel: 'What if',
        sourceLabel: 'Injected',
        channelLabel: 'Bank sync',
        changedDomains: ['finance.budget'],
        injected: true,
        contexts: [
          context(
            'budget',
            [
              fact(`${id}-budget-before`, 'finance', 'Monzo', at, {
                month: 'November',
                monthlyGroceries: 571,
                groceryBudget: 450,
                dataQuality: 'duplicate_unreconciled',
              }),
            ],
            [
              fact(`${id}-budget-after`, 'finance', 'Monzo', at, {
                month: 'November',
                monthlyGroceries: 487,
                groceryBudget: 450,
                overBy: 37,
                duplicateResolved: true,
              }),
            ],
          ),
        ],
      };
    default:
      return null;
  }
}
