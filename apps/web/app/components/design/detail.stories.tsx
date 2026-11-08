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
    <div className="min-h-full bg-[#060709] p-6 text-[#f2f4f8]">
      <div className="mx-auto grid max-w-3xl gap-4">{children}</div>
    </div>
  );
}

export const Hero: StoryObj = {
  name: 'DetailHero + BackLink',
  render: () => (
    <Shell>
      <div>
        <BackLink to="/career/work" label="Work history" />
        <DetailHero
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
        <p className="text-[15px] leading-relaxed text-[#f2f4f8]">
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
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0e1116]/90 p-5">
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
      <div className="flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-[#0e1116]/90 p-5">
        <Chip>TypeScript</Chip>
        <Chip tone="volt">React</Chip>
        <Chip onRemove={() => window.alert('removed')} removeLabel="Remove Go">
          Go
        </Chip>
      </div>
    </Shell>
  ),
};
