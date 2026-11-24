import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { ProactivitySuggestion } from '.';
import type { SuggestionModel, SuggestionReview, SuggestionState } from './types';

const preparedCharges = [
  { merchant: 'Legalinc Corporate Services', amount: 719, charges: 1 },
  { merchant: 'Scan', amount: 698.48, charges: 1 },
  { merchant: 'AMAZON.CO.UK', amount: 403.67, charges: 6 },
];

const budgetReview: Extract<SuggestionReview, { kind: 'finance.budget' }> = {
  kind: 'finance.budget',
  category: 'Food',
  tag: 'Dining Out',
  cadence: 'monthly',
  currency: 'GBP',
  currentAmount: 250,
  proposedAmount: 100,
  categoryBudget: 550,
  tagTotal: 550,
};

const budgetSuggestion: SuggestionModel = {
  goalTitle: 'Stay inside the monthly plan',
  summary: 'You are £5,957 short this month.',
  reason:
    '£9,594 has gone out and £3,637 has come in so far. October ended £2,639 ahead, so this is a change in direction rather than a slow month.',
  review: budgetReview,
  preparedCharges,
  appliedLabel: 'Done — Dining Out lowered to £100.',
  snoozedUntil: '2026-11-27T09:00:00.000Z',
};

const chargesSuggestion: SuggestionModel = {
  ...budgetSuggestion,
  summary: 'November is running a large projected deficit.',
  review: { kind: 'finance.charges', charges: preparedCharges },
  appliedLabel: 'Done — charges reviewed. Nothing was cancelled.',
};

const taskSuggestion: SuggestionModel = {
  goalTitle: 'Find a better role',
  summary: 'Nothing new to judge yet.',
  reason:
    'Your last application was 23 February 2025, so the engine deferred instead of guessing. It will look again on 1 December.',
  review: {
    kind: 'task',
    title: 'Apply to 3 roles',
    dueAt: '2026-11-30T09:00:00.000Z',
  },
  appliedLabel: 'Done — added to tasks for Monday.',
  snoozedUntil: '2026-11-27T09:00:00.000Z',
};

const pauseSuggestion: SuggestionModel = {
  ...taskSuggestion,
  review: { kind: 'goal.pause' },
  appliedLabel: 'Done — this goal is paused. Resume it anytime.',
};

function Demo({
  suggestion,
  initial = 'needs-you',
  defaultReviewing = false,
  busy = false,
}: {
  suggestion: SuggestionModel;
  initial?: SuggestionState;
  defaultReviewing?: boolean;
  busy?: boolean;
}) {
  const [state, setState] = useState<SuggestionState>(initial);

  return (
    <div className="min-h-screen bg-background px-6 py-10 text-foreground">
      <div className="mx-auto max-w-3xl">
        <p className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
          Proactivity · design studio
        </p>
        <h1 className="mt-2 text-[30px] leading-tight font-semibold tracking-[-0.02em]">
          One finding, one offer.
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          One suggestion, one review type. The review body is chosen by{' '}
          <span className="font-mono text-[12px]">review.kind</span>; the shell stays the same.
        </p>

        <div className="mt-8 border-t border-border">
          <ProactivitySuggestion
            busy={busy}
            defaultOpen
            defaultReviewing={defaultReviewing}
            onApply={() => setState('applied')}
            onSnooze={() => setState('snoozed')}
            onUndo={() => setState('needs-you')}
            state={state}
            suggestion={suggestion}
          />
        </div>

        <p className="mt-6 font-mono text-[10px] tracking-[0.1em] text-muted-foreground uppercase">
          state: {state} · review: {suggestion.review.kind}
        </p>
      </div>
    </div>
  );
}

const meta = {
  title: 'Proactivity/Suggestion',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const FinanceBudgetReview: Story = {
  name: 'Finance · Budget review',
  render: () => <Demo defaultReviewing suggestion={budgetSuggestion} />,
};

export const FinanceBudgetOffer: Story = {
  name: 'Finance · Budget (review closed)',
  render: () => <Demo suggestion={budgetSuggestion} />,
};

export const FinanceCharges: Story = {
  name: 'Finance · Charges',
  render: () => <Demo defaultReviewing suggestion={chargesSuggestion} />,
};

export const FinanceApplied: Story = {
  name: 'Finance · Applied',
  render: () => <Demo initial="applied" suggestion={budgetSuggestion} />,
};

export const FinanceSnoozed: Story = {
  name: 'Finance · Snoozed',
  render: () => <Demo initial="snoozed" suggestion={budgetSuggestion} />,
};

export const CareerTask: Story = {
  name: 'Career · Task',
  render: () => <Demo defaultReviewing initial="waiting" suggestion={taskSuggestion} />,
};

export const CareerPause: Story = {
  name: 'Career · Pause goal',
  render: () => <Demo defaultReviewing initial="waiting" suggestion={pauseSuggestion} />,
};

type StudioArgs = {
  goalTitle: string;
  summary: string;
  reason: string;
  category: string;
  tag: string;
  currentAmount: number;
  proposedAmount: number;
  reviewKind: 'finance.budget' | 'finance.charges' | 'task' | 'goal.pause';
  initialState: SuggestionState;
  initiallyReviewing: boolean;
};

export const Studio: StoryObj<StudioArgs> = {
  name: 'Studio · controls',
  args: {
    goalTitle: 'Stay inside the monthly plan',
    summary: 'You are £5,957 short this month.',
    reason: '£9,594 has gone out and £3,637 has come in so far. October ended £2,639 ahead.',
    category: 'Food',
    tag: 'Dining Out',
    currentAmount: 250,
    proposedAmount: 100,
    reviewKind: 'finance.budget',
    initialState: 'needs-you',
    initiallyReviewing: true,
  },
  argTypes: {
    goalTitle: { control: 'text' },
    summary: { control: 'text' },
    reason: { control: 'text' },
    category: { control: 'text' },
    tag: { control: 'text' },
    currentAmount: { control: { type: 'number', min: 0, step: 10 } },
    proposedAmount: { control: { type: 'number', min: 0, step: 5 } },
    reviewKind: {
      control: 'select',
      options: ['finance.budget', 'finance.charges', 'task', 'goal.pause'],
    },
    initialState: {
      control: 'select',
      options: ['needs-you', 'waiting', 'applied', 'snoozed'],
    },
    initiallyReviewing: { control: 'boolean' },
  },
  render: (args) => {
    const base = budgetSuggestion;
    const review: SuggestionReview =
      args.reviewKind === 'finance.budget'
        ? {
            ...budgetReview,
            category: args.category,
            tag: args.tag,
            currentAmount: args.currentAmount,
            proposedAmount: args.proposedAmount,
            categoryBudget: Math.max(args.currentAmount, 550),
            tagTotal: Math.max(args.currentAmount, 550),
          }
        : args.reviewKind === 'finance.charges'
          ? ({ kind: 'finance.charges', charges: preparedCharges } as const)
          : args.reviewKind === 'task'
            ? ({
                kind: 'task',
                title: 'Apply to 3 roles',
                dueAt: '2026-11-30T09:00:00.000Z',
              } as const)
            : ({ kind: 'goal.pause' } as const);

    const suggestion: SuggestionModel = {
      ...base,
      goalTitle: args.goalTitle,
      summary: args.summary,
      reason: args.reason,
      review,
    };

    return (
      <Demo
        defaultReviewing={args.initiallyReviewing}
        initial={args.initialState}
        key={`${args.reviewKind}:${args.currentAmount}:${args.proposedAmount}:${args.initialState}`}
        suggestion={suggestion}
      />
    );
  },
};
