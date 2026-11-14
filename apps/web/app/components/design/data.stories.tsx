import type { Meta, StoryObj } from '@storybook/react-vite';
import { Phone } from 'lucide-react';

import { ChartCard } from '~/components/design/chart-card';
import { DataTable } from '~/components/design/data-table';
import { SelectField } from '~/components/design/form-field';
import {
  CurrencyField,
  IconField,
  PrefixInput,
  TextAreaInput,
  TextInput,
} from '~/components/design/forms';

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-full bg-background p-6 text-foreground">{children}</div>;
}

const meta = {
  title: 'Design System/Data',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export default meta;

type Week = {
  week: number;
  weekStart: string;
  beginningCash: number;
  netChange: number;
  endingCash: number;
};

const WEEKS: Week[] = [
  { week: 1, weekStart: '2026-11-08', beginningCash: 110023, netChange: -16, endingCash: 110007 },
  { week: 2, weekStart: '2026-11-15', beginningCash: 110007, netChange: -16, endingCash: 109991 },
  { week: 3, weekStart: '2026-11-22', beginningCash: 109991, netChange: -16, endingCash: 109975 },
];

export const Table: StoryObj = {
  name: 'DataTable',
  render: () => (
    <Shell>
      <div className="max-w-3xl rounded-sm border border-border bg-card p-5">
        <DataTable<Week>
          ariaLabel="Weekly runway trajectory"
          rows={WEEKS}
          keyOf={(row) => `week-${row.week}`}
          columns={[
            {
              key: 'week',
              header: 'Week',
              render: (row) => (
                <span>
                  {row.week} · {row.weekStart}
                </span>
              ),
            },
            {
              key: 'starting',
              header: 'Starting',
              render: (row) => `$${row.beginningCash.toLocaleString()}`,
            },
            {
              key: 'net',
              header: 'Net change',
              align: 'right',
              render: (row) => `$${row.netChange.toLocaleString()}`,
            },
            {
              key: 'ending',
              header: 'Ending',
              align: 'right',
              render: (row) => `$${row.endingCash.toLocaleString()}`,
            },
          ]}
        />
      </div>
    </Shell>
  ),
};

export const ChartStates: StoryObj = {
  name: 'ChartCard states',
  render: () => (
    <Shell>
      <div className="grid max-w-4xl gap-4">
        <ChartCard title="Spending pace" subtitle="Month to date" height="sm" state="loading" />
        <ChartCard
          title="Spending pace"
          subtitle="Month to date"
          height="sm"
          state="empty"
          emptyTitle="No spending recorded this month"
        />
        <ChartCard
          title="Spending pace"
          subtitle="Month to date"
          height="sm"
          state="error"
          errorTitle="Spending unavailable"
          errorDescription="We couldn't load the chart. Check your connection."
        />
      </div>
    </Shell>
  ),
};

type SelectFieldStoryType = StoryObj<Meta<typeof SelectField>>;

export const SelectFieldStory: SelectFieldStoryType = {
  name: 'SelectField',
  args: {
    label: 'Forecast currency',
    name: 'currencyCode',
    placeholder: 'Choose currency',
    options: [
      { value: 'USD', label: 'USD' },
      { value: 'EUR', label: 'EUR' },
      { value: 'GBP', label: 'GBP' },
    ],
  },
  argTypes: {
    label: { control: 'text' },
    name: { control: 'text' },
    placeholder: { control: 'text' },
    options: { control: 'object' },
    required: { control: 'boolean' },
    hint: { control: 'text' },
    error: { control: 'text' },
  },
  render: (args) => (
    <Shell>
      <div className="max-w-md rounded-sm border border-border bg-card p-6">
        <SelectField {...args} />
      </div>
    </Shell>
  ),
};

type TextInputStoryType = StoryObj<Meta<typeof TextInput>>;

export const TextInputStory: TextInputStoryType = {
  name: 'TextInput',
  args: {
    label: 'Job title',
    name: 'title',
    required: true,
    placeholder: 'e.g. Senior Engineer',
  },
  argTypes: {
    label: { control: 'text' },
    name: { control: 'text' },
    type: { control: 'select', options: ['text', 'email', 'number', 'tel', 'url'] },
    required: { control: 'boolean' },
    placeholder: { control: 'text' },
    hint: { control: 'text' },
    disabled: { control: 'boolean' },
    readOnly: { control: 'boolean' },
  },
  render: (args) => (
    <Shell>
      <div className="max-w-md rounded-sm border border-border bg-card p-6">
        <TextInput {...args} />
      </div>
    </Shell>
  ),
};

type CurrencyFieldStoryType = StoryObj<Meta<typeof CurrencyField>>;

export const CurrencyFieldStory: CurrencyFieldStoryType = {
  name: 'CurrencyField',
  args: {
    label: 'Purchase amount',
    name: 'purchase',
    currency: 'GBP',
    defaultValue: '400',
    min: 0,
    step: 0.01,
  },
  argTypes: {
    label: { control: 'text' },
    name: { control: 'text' },
    currency: { control: 'select', options: ['GBP', 'USD', 'EUR', 'CAD', 'AUD'] },
    defaultValue: { control: 'text' },
    placeholder: { control: 'text' },
    required: { control: 'boolean' },
    min: { control: 'number' },
    max: { control: 'number' },
    step: { control: 'number' },
    hint: { control: 'text' },
    disabled: { control: 'boolean' },
    readOnly: { control: 'boolean' },
  },
  render: (args) => (
    <Shell>
      <div className="max-w-md rounded-sm border border-border bg-card p-6">
        <CurrencyField {...args} />
      </div>
    </Shell>
  ),
};

type TextAreaInputStoryType = StoryObj<Meta<typeof TextAreaInput>>;

export const TextAreaInputStory: TextAreaInputStoryType = {
  name: 'TextAreaInput',
  args: {
    label: 'Description',
    name: 'description',
    rows: 3,
    placeholder: 'What did you actually do?',
  },
  argTypes: {
    label: { control: 'text' },
    name: { control: 'text' },
    rows: { control: { type: 'range', min: 2, max: 10, step: 1 } },
    placeholder: { control: 'text' },
    required: { control: 'boolean' },
    hint: { control: 'text' },
    disabled: { control: 'boolean' },
    readOnly: { control: 'boolean' },
  },
  render: (args) => (
    <Shell>
      <div className="max-w-md rounded-sm border border-border bg-card p-6">
        <TextAreaInput {...args} />
      </div>
    </Shell>
  ),
};

type PrefixInputStoryType = StoryObj<Meta<typeof PrefixInput>>;

export const PrefixInputStory: PrefixInputStoryType = {
  name: 'PrefixInput',
  args: {
    label: 'Profile URL',
    name: 'slug',
    prefix: 'career.dev/p/',
    placeholder: 'your-profile-name',
    hint: 'Lowercase letters, numbers, and hyphens only.',
  },
  argTypes: {
    label: { control: 'text' },
    name: { control: 'text' },
    prefix: { control: 'text' },
    placeholder: { control: 'text' },
    required: { control: 'boolean' },
    hint: { control: 'text' },
    error: { control: 'text' },
    disabled: { control: 'boolean' },
    readOnly: { control: 'boolean' },
  },
  render: (args) => (
    <Shell>
      <div className="max-w-md rounded-sm border border-border bg-card p-6">
        <PrefixInput {...args} />
      </div>
    </Shell>
  ),
};

type IconFieldStoryType = StoryObj<Meta<typeof IconField>>;

export const IconFieldStory: IconFieldStoryType = {
  name: 'IconField',
  args: {
    label: 'Phone',
    name: 'phone',
    placeholder: '+1 555 0100',
    type: 'tel',
  },
  argTypes: {
    label: { control: 'text' },
    name: { control: 'text' },
    placeholder: { control: 'text' },
    type: { control: 'select', options: ['text', 'email', 'number', 'tel', 'url'] },
    required: { control: 'boolean' },
    disabled: { control: 'boolean' },
    readOnly: { control: 'boolean' },
    hint: { control: 'text' },
    error: { control: 'text' },
    icon: { control: false },
  },
  render: (args) => (
    <Shell>
      <div className="max-w-md rounded-sm border border-border bg-card p-6">
        <IconField {...args} icon={<Phone className="size-4" aria-hidden />} />
      </div>
    </Shell>
  ),
};
