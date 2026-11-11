import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import {
  AddButton,
  CardHeader,
  FilterTabs,
  PageHeader,
  PanelState,
  SectionCard,
  Stat,
} from '~/components/design';
import { AppNavLink } from '~/components/shell/app-nav-link';
import { Button } from '~/components/ui/button';

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-full bg-background p-6 text-foreground">{children}</div>;
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
        actions={<Button size="sm">Save settings</Button>}
      />
    </Shell>
  ),
};

export const CompactRouteHeaders: StoryObj = {
  name: 'Compact route headers',
  render: () => (
    <Shell>
      <div className="grid gap-10">
        <PageHeader
          eyebrow="Tasks"
          title={<span className="sr-only">Tasks</span>}
          actions={<AddButton label="New task" />}
        />
        <PageHeader
          eyebrow="Collections"
          title={<span className="sr-only">Collections</span>}
          actions={<AddButton label="New collection" />}
        />
      </div>
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
            <Stat label="Runway" value="143 mo" sub="Minimum balance drops below zero" />
          </div>
        </SectionCard>
      </div>
    </Shell>
  ),
};

export const LockedCardHeader: StoryObj = {
  name: 'CardHeader',
  render: () => (
    <Shell>
      <SectionCard className="max-w-xl">
        <CardHeader title="Monthly Breakdown" action={<Button size="sm">Export</Button>} />
        <div className="p-4 pt-0">Card body begins directly below the shared header.</div>
      </SectionCard>
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

export const TaskStatusFilters: StoryObj = {
  name: 'FilterTabs',
  render: () => {
    const [value, setValue] = useState<'open' | 'done' | 'all'>('open');
    return (
      <Shell>
        <div className="flex justify-center">
          <FilterTabs
            ariaLabel="Filter tasks"
            value={value}
            onChange={setValue}
            options={[
              { value: 'open', label: 'Open' },
              { value: 'done', label: 'Completed' },
              { value: 'all', label: 'All' },
            ]}
          />
        </div>
      </Shell>
    );
  },
};

export const AddAction: StoryObj = {
  name: 'AddButton',
  render: () => (
    <Shell>
      <div className="flex items-center gap-3">
        <AddButton label="New task" />
        <AddButton label="New collection" />
      </div>
    </Shell>
  ),
};

export const NavLinks: StoryObj = {
  name: 'AppNavLink',
  render: () => (
    <Shell>
      <div className="grid max-w-xs gap-1">
        <AppNavLink to="/tasks" label="Tasks" variant="sidebar" />
        <AppNavLink to="/finance" label="Finance" variant="sidebar" />
      </div>
      <div className="mt-6 flex gap-1">
        <AppNavLink to="/finance" label="Overview" variant="pill" />
        <AppNavLink to="/finance/runway" label="Runway" variant="pill" />
      </div>
      <p className="mt-4 font-mono text-[11px] text-muted-foreground uppercase">
        Active state follows the router location
      </p>
    </Shell>
  ),
};
