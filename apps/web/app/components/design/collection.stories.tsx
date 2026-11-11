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
    <div className="min-h-full bg-background p-6 text-foreground">
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
      <div className="overflow-hidden rounded-sm border border-border bg-card">
        <List.Items ariaLabel="Tasks">
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
              leading={<span className="size-2 shrink-0 rounded-full bg-primary" aria-hidden />}
              meta={<span>Everyday Checking · depository</span>}
              trailing={<span className="text-foreground">$5,938</span>}
            />
          </li>
        </List.Items>
      </div>
    </Shell>
  ),
};

export const CompoundList: StoryObj = {
  name: 'List.Search + List.Items + List.Pagination',
  render: () => {
    const [page, setPage] = useState(0);
    const [query, setQuery] = useState('');

    return (
      <Shell>
        <List>
          <List.Search>
            <SearchInput
              value={query}
              onChange={setQuery}
              ariaLabel="Search transactions"
              placeholder="Search transactions..."
            />
          </List.Search>
          <List.Items as="div" ariaLabel="Transactions" variant="divided">
            {['Parking Garage', 'Airline', 'Cashback Reward'].map((label) => (
              <div
                key={label}
                role="listitem"
                className="border-b border-border px-4 py-3 last:border-0"
              >
                {label}
              </div>
            ))}
          </List.Items>
          <List.Pagination
            currentPage={page}
            totalPages={3}
            onPageChange={setPage}
            summary="12 transactions"
          />
        </List>
      </Shell>
    );
  },
};

export const Headers: StoryObj = {
  name: 'SectionHeader',
  render: () => (
    <Shell>
      <div className="rounded-sm border border-border bg-card p-5">
        <SectionHeader title="Accounts" actionLabel="All accounts" actionTo="/finance/accounts" />
      </div>
      <div className="rounded-sm border border-border bg-card p-5">
        <SectionHeader title="Top merchants" description="By spending this month" />
      </div>
    </Shell>
  ),
};

export const KeyValues: StoryObj = {
  name: 'KeyValue + KeyValueList',
  render: () => (
    <Shell>
      <div className="rounded-sm border border-border bg-card px-5">
        <KeyValueList>
          <KeyValue label="Income" tone="success" value="$4,200" />
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
      <div className="grid gap-5 rounded-sm border border-border bg-card p-5">
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
      <div className="overflow-hidden rounded-sm border border-border bg-card">
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
      <div className="flex items-center gap-4 rounded-sm border border-border bg-card p-5">
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
    <div className="min-h-full bg-background text-foreground">
      {(['sm', 'md', 'lg'] as const).map((size) => (
        <Container key={size} size={size}>
          <div className="rounded-sm border border-dashed border-border p-4 font-mono text-xs text-muted-foreground">
            Container size=&quot;{size}&quot;
          </div>
        </Container>
      ))}
    </div>
  ),
};
