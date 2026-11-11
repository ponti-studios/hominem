import type { Meta, StoryObj } from '@storybook/react-vite';

import { PageHeader } from '~/components/design/page-header';
import { SectionCard, Stat } from '~/components/design/surfaces';
import { Button } from '~/components/ui/button';

const meta = {
  title: 'Design System/Monochrome',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export default meta;

const COLORS = [
  ['Page', 'background'],
  ['Ink', 'primary'],
  ['Supporting text', 'muted-foreground'],
  ['Rule', 'border'],
  ['Quiet surface', 'muted'],
] as const;

export const Foundation: StoryObj = {
  name: 'Foundation and page composition',
  render: () => (
    <main className="min-h-screen bg-background p-6 text-foreground sm:p-10">
      <div className="mx-auto max-w-4xl">
        <PageHeader
          eyebrow="Design system"
          title="One monochrome language"
          description="Type, spacing, alignment, and neutral rules carry hierarchy."
          actions={<Button>Save changes</Button>}
        />
        <div className="grid gap-4 border-t border-border py-6 sm:grid-cols-3">
          {COLORS.map(([label, token]) => (
            <div key={token} className="border-b border-border py-3">
              <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
                {label}
              </p>
              <p className="mt-2 rounded-sm bg-card p-3 text-sm text-foreground">
                <code>--{token}</code>
              </p>
            </div>
          ))}
        </div>
        <SectionCard className="mt-6 rounded-sm bg-muted">
          <div className="grid gap-5 p-5 sm:grid-cols-3">
            <Stat label="Monthly usage" value="42%" sub="Within allowance" />
            <Stat label="Available" value="$1,240" sub="Across 2 accounts" />
            <Stat label="Attention" value="Review" tone="danger" sub="One item needs review" />
          </div>
        </SectionCard>
      </div>
    </main>
  ),
};
