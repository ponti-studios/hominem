import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { InitialsAvatar } from '~/components/design/avatar';
import { Container } from '~/components/design/container';
import { KeyValue, KeyValueList } from '~/components/design/key-value';
import { List, RowLink } from '~/components/design/lists';
import { Meter } from '~/components/design/meter';
import { SearchInput } from '~/components/design/search-input';
import { SectionHeader } from '~/components/design/section-header';
import { BlockSkeleton, ListSkeleton } from '~/components/design/skeleton';
import { Badge } from '~/components/ui/badge';

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full bg-[#060709] p-6 text-[#f2f4f8] dark">
      <div className="mx-auto grid max-w-3xl gap-4">{children}</div>
    </div>
  );
}

const meta = {
  title: 'Design System/Collections',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export default meta;

export const RowLinks: StoryObj = {
  name: 'RowLink + List',
  render: () => (
    <Shell>
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0e1116]/90">
        <List ariaLabel="Tasks">
          <li>
            <RowLink
              to="/tasks/1"
              title="Pick up dry cleaning"
              subtitle="Shirts and a winter coat"
              badges={<Badge variant="outline">medium</Badge>}
              meta={<span>Due Sep 18</span>}
            />
          </li>
          <li>
            <RowLink
              to="/finance/accounts/1"
              title="Everyday Checking"
              leading={<span className="size-2 shrink-0 rounded-full bg-[#d7ff3e]" aria-hidden />}
              meta={<span>Everyday Checking · depository</span>}
              trailing={<span className="text-[#f2f4f8]">$5,938</span>}
            />
          </li>
        </List>
      </div>
    </Shell>
  ),
};

export const Headers: StoryObj = {
  name: 'SectionHeader',
  render: () => (
    <Shell>
      <div className="rounded-2xl border border-white/10 bg-[#0e1116]/90 p-5">
        <SectionHeader title="Accounts" actionLabel="All accounts" actionTo="/finance/accounts" />
      </div>
      <div className="rounded-2xl border border-white/10 bg-[#0e1116]/90 p-5">
        <SectionHeader title="Top merchants" description="By spending this month" />
      </div>
    </Shell>
  ),
};

export const KeyValues: StoryObj = {
  name: 'KeyValue + KeyValueList',
  render: () => (
    <Shell>
      <div className="rounded-2xl border border-white/10 bg-[#0e1116]/90 px-5">
        <KeyValueList>
          <KeyValue label="Income" tone="volt" value="$4,200" />
          <KeyValue label="Net cash flow" value="-$750" />
          <KeyValue label="Accounts" value="12" />
        </KeyValueList>
      </div>
    </Shell>
  ),
};

export const Meters: StoryObj = {
  name: 'Meter',
  render: () => (
    <Shell>
      <div className="grid gap-5 rounded-2xl border border-white/10 bg-[#0e1116]/90 p-5">
        <Meter label="Whole Foods" valueLabel="$214.50" percent={100} />
        <Meter label="Shell" valueLabel="$86.20" percent={40} description="of top merchant spend" />
        <Meter label="Netflix" valueLabel="$15.49" percent={7} />
      </div>
    </Shell>
  ),
};

export const Skeletons: StoryObj = {
  name: 'ListSkeleton + BlockSkeleton',
  render: () => (
    <Shell>
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0e1116]/90">
        <ListSkeleton rows={3} />
      </div>
      <BlockSkeleton />
    </Shell>
  ),
};

export const Search: StoryObj = {
  name: 'SearchInput',
  render: () => {
    const [value, setValue] = useState('groceries');
    return (
      <Shell>
        <SearchInput
          value={value}
          onChange={setValue}
          onClear={() => setValue('')}
          placeholder="Search transactions..."
          ariaLabel="Search transactions"
        />
        <SearchInput value="" onChange={() => {}} placeholder="Search…" ariaLabel="Search" />
      </Shell>
    );
  },
};

export const Avatars: StoryObj = {
  name: 'InitialsAvatar',
  render: () => (
    <Shell>
      <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-[#0e1116]/90 p-5">
        <InitialsAvatar name="Alex Example" />
        <InitialsAvatar name="Jo" size="md" />
        <InitialsAvatar name="sam@example.com" />
      </div>
    </Shell>
  ),
};

export const Containers: StoryObj = {
  name: 'Container',
  render: () => (
    <div className="min-h-full bg-[#060709] text-[#f2f4f8]">
      {(['sm', 'md', 'lg'] as const).map((size) => (
        <Container key={size} size={size}>
          <div className="rounded-xl border border-dashed border-white/20 p-4 font-mono text-xs text-[#9ba3b4]">
            Container size=&quot;{size}&quot;
          </div>
        </Container>
      ))}
    </div>
  ),
};
