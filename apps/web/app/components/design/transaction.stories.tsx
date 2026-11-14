import type { Meta, StoryObj } from '@storybook/react-vite';

import { ProgressBar } from './progress-bar';
import { Transaction } from './transaction';

const meta = {
  title: 'Design System/Finance',
  parameters: { layout: 'padded' },
} satisfies Meta;

export default meta;

export const ReviewList: StoryObj = {
  render: () => (
    <div className="max-w-3xl space-y-4 bg-background p-4 text-foreground">
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>2,418 remaining</span>
          <span>21%</span>
        </div>
        <ProgressBar value={598} max={3016} label="Rulings completed" />
      </div>
      <div className="overflow-hidden rounded-xl border border-border">
        <Transaction
          description="EVERYMAN CINEMA"
          date="Nov 4, 2026"
          category="Entertainment · Movies"
          amount="−£100.00"
          selected
          onSelect={() => undefined}
        />
        <Transaction
          description="EVERYMAN CINEMA"
          date="Oct 18, 2026"
          category="Entertainment · Movies"
          amount="−£25.00"
          onSelect={() => undefined}
        />
      </div>
    </div>
  ),
};
