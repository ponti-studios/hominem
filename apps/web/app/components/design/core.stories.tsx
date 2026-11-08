import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { PageHeader } from '~/components/design/page-header';
import { PanelState, SectionCard, SegmentedControl, Stat } from '~/components/design/surfaces';
import { AppNavLink } from '~/components/shell/app-nav-link';
import { Button } from '~/components/ui/button';

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-full bg-[#060709] p-6 text-[#f2f4f8] dark">{children}</div>;
}

const meta = {
  title: 'Design System/Core',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export default meta;

export const PageHeaderDefault: StoryObj = {
  name: 'PageHeader',
  render: () => (
    <Shell>
      <PageHeader
        eyebrow="Finance · Runway"
        title="Financial Runway Calculator"
        description="Live ledger forecast plus manual scenarios."
        accent="#9d7bff"
        actions={<Button size="sm">Save settings</Button>}
      />
    </Shell>
  ),
};

export const SectionCardGrid: StoryObj = {
  name: 'SectionCard + Stat',
  render: () => (
    <Shell>
      <div className="grid gap-4 md:grid-cols-4">
        <SectionCard index={0}>
          <div className="p-5">
            <Stat label="Ledger Cash" value="$110,023" sub="Across 5 liquid accounts" />
          </div>
        </SectionCard>
        <SectionCard index={1}>
          <div className="p-5">
            <Stat label="Weekly Burn" value="$16" sub="$16 recurring · $0 allowance" />
          </div>
        </SectionCard>
        <SectionCard index={2}>
          <div className="p-5">
            <Stat
              label="Runway"
              value="143 mo"
              accent="#ff6b6b"
              sub="Minimum balance drops below zero"
            />
          </div>
        </SectionCard>
      </div>
    </Shell>
  ),
};

export const PanelStates: StoryObj = {
  name: 'PanelState',
  render: () => (
    <Shell>
      <div className="grid max-w-3xl gap-4">
        <SectionCard>
          <PanelState
            title="Nothing here yet"
            description="Capture the first thing on your mind. It takes two seconds."
            action={<Button size="sm">New task</Button>}
          />
        </SectionCard>
        <SectionCard>
          <PanelState
            title="Tasks unavailable"
            description="We couldn't reach your list. Check your connection and retry."
            action={
              <Button size="sm" variant="secondary">
                Try again
              </Button>
            }
          />
        </SectionCard>
      </div>
    </Shell>
  ),
};

export const Segmented: StoryObj = {
  name: 'SegmentedControl',
  render: () => {
    const [value, setValue] = useState<'open' | 'done' | 'all'>('open');
    return (
      <Shell>
        <SegmentedControl
          ariaLabel="Filter tasks"
          value={value}
          onChange={setValue}
          options={[
            { value: 'open', label: 'Open' },
            { value: 'done', label: 'Completed' },
            { value: 'all', label: 'All' },
          ]}
        />
      </Shell>
    );
  },
};

export const NavLinks: StoryObj = {
  name: 'AppNavLink',
  render: () => (
    <Shell>
      <div className="grid max-w-xs gap-1">
        <AppNavLink to="/tasks" label="Tasks" accent="#d7ff3e" variant="sidebar" />
        <AppNavLink to="/finance" label="Finance" accent="#9d7bff" variant="sidebar" />
      </div>
      <div className="mt-6 flex gap-1">
        <AppNavLink to="/finance" label="Overview" accent="#9d7bff" variant="pill" />
        <AppNavLink to="/finance/runway" label="Runway" accent="#9d7bff" variant="pill" />
      </div>
      <p className="mt-4 font-mono text-[11px] text-[#5e6678] uppercase">
        Active state follows the router location
      </p>
    </Shell>
  ),
};
