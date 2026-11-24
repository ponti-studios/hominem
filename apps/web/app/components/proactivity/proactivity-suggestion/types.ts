export type PreparedCharge = {
  merchant: string;
  amount: number;
  charges: number;
};

/**
 * The review body a suggestion opens into. One variant per kind, so a new
 * domain adds a component and a row in the registry, not a branch in the shell.
 */
export type SuggestionReview =
  | {
      kind: 'finance.budget';
      category: string;
      tag: string;
      cadence: string;
      currency: string;
      currentAmount: number;
      proposedAmount: number;
      categoryBudget: number;
      /** What the budget's tag set totals today, before this change. */
      tagTotal: number;
      note?: string;
    }
  | {
      kind: 'finance.charges';
      charges: PreparedCharge[];
      note?: string;
    }
  | {
      kind: 'task';
      title: string;
      dueAt: string;
      note?: string;
    }
  | {
      kind: 'goal.pause';
      until?: string;
      note?: string;
    };

export type SuggestionState = 'needs-you' | 'waiting' | 'applied' | 'snoozed';

export type SuggestionModel = {
  goalTitle: string;
  summary: string;
  reason: string;
  review: SuggestionReview;
  /** Read-only charges offered alongside the primary review. */
  preparedCharges?: PreparedCharge[];
  appliedLabel?: string;
  snoozedUntil?: string;
};

export type ReviewProps = {
  review: SuggestionReview;
  busy?: boolean;
  onApply: (value?: number) => void;
  onCancel: () => void;
};
