import type { Meta, StoryObj } from '@storybook/react-vite';

import { Chip } from '~/components/design/chip';
import { DeleteButton } from '~/components/design/delete-button';
import { BackLink, DetailField, DetailHero, DetailSection } from '~/components/design/detail';
import { StatusBadge } from '~/modules/career/components/status-badge';

const meta = {
  title: 'Design System/Detail',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export default meta;

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full bg-background p-6 text-foreground">
      <div className="mx-auto grid max-w-3xl gap-4">{children}</div>
    </div>
  );
}

export const Hero: StoryObj = {
  name: 'DetailHero + BackLink',
  render: () => (
    <Shell>
      <div>
        <DetailHero
          eyebrow="Work history"
          back={<BackLink to="/career/work" label="Work history" variant="icon" />}
          title="Senior Engineer"
          subtitle="Acme Inc"
          badges={
            <>
              <StatusBadge tone="success" label="Current" />
              <StatusBadge tone="neutral" label="Employment" />
            </>
          }
          actions={<DeleteButton itemName="Senior Engineer at Acme Inc" />}
        />
      </div>
    </Shell>
  ),
};

export const Sections: StoryObj = {
  name: 'DetailSection + DetailField',
  render: () => (
    <Shell>
      <DetailSection title="Details">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <DetailField label="Location" value="San Francisco" />
          <DetailField label="Start date" value="2021-03-01" mono />
          <DetailField label="End date" value="Present" mono />
          <DetailField label="Salary" value="$180,000 – $220,000 USD" mono />
        </div>
      </DetailSection>
      <DetailSection title="Description">
        <p className="text-[15px] leading-relaxed text-foreground">
          Led the platform team through a full rewrite.
        </p>
      </DetailSection>
    </Shell>
  ),
};

export const DeleteVariants: StoryObj = {
  name: 'DeleteButton',
  render: () => (
    <Shell>
      <div className="flex items-center gap-3 rounded-sm border border-border bg-card p-5">
        <DeleteButton itemName="Q3 invoice" />
        <DeleteButton itemName="Q3 invoice" label="Remove" variant="ghost" />
        <DeleteButton
          itemName="old export"
          label="Delete file"
          onConfirm={() => window.alert('confirmed')}
        />
      </div>
    </Shell>
  ),
};

export const Chips: StoryObj = {
  name: 'Chip',
  render: () => (
    <Shell>
      <div className="flex flex-wrap gap-2 rounded-sm border border-border bg-card p-5">
        <Chip>TypeScript</Chip>
        <Chip>React</Chip>
        <Chip onRemove={() => window.alert('removed')} removeLabel="Remove Go">
          Go
        </Chip>
      </div>
    </Shell>
  ),
};
