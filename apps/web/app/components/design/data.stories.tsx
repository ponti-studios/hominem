import type { Meta, StoryObj } from '@storybook/react-vite';
import { Phone } from 'lucide-react';

import { ChartCard } from '~/components/design/chart-card';
import { DataTable } from '~/components/design/data-table';
import { Field, SelectField } from '~/components/design/form-field';
import {
  FormGrid,
  IconField,
  PrefixInput,
  TextAreaInput,
  TextInput,
} from '~/components/design/forms';
import { Input } from '~/components/ui/input';

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-full bg-[#060709] p-6 text-[#f2f4f8]">{children}</div>;
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
      <div className="max-w-3xl rounded-2xl border border-white/10 bg-[#0e1116]/90 p-5">
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

export const FormFields: StoryObj = {
  name: 'Field + SelectField',
  render: () => (
    <Shell>
      <div className="grid max-w-md gap-5 rounded-2xl border border-white/10 bg-[#0e1116]/90 p-6">
        <SelectField
          label="Forecast currency"
          name="currencyCode"
          placeholder="Choose currency"
          options={[
            { value: 'USD', label: 'USD' },
            { value: 'EUR', label: 'EUR' },
            { value: 'GBP', label: 'GBP' },
          ]}
        />
        <Field label="Monthly cap" hint="Applies to the selected currency.">
          {(id) => (
            <Input id={id} name="amount" type="number" min="0" step="0.01" placeholder="0" />
          )}
        </Field>
        <Field label="Monthly cap" error="Enter a valid amount.">
          {(id) => <Input id={id} name="amount" type="number" aria-invalid="true" />}
        </Field>
      </div>
    </Shell>
  ),
};

export const TextInputs: StoryObj = {
  name: 'TextInput + TextAreaInput + FormGrid',
  render: () => (
    <Shell>
      <div className="grid max-w-md gap-5 rounded-2xl border border-white/10 bg-[#0e1116]/90 p-6">
        <TextInput label="Job Title" name="title" required placeholder="e.g. Senior Engineer" />
        <FormGrid>
          <TextInput label="Location" name="location" placeholder="Remote" />
          <TextInput label="Salary ($/yr)" name="salary" type="number" />
        </FormGrid>
        <TextAreaInput
          label="Description"
          name="description"
          rows={3}
          placeholder="What did you actually do?"
        />
      </div>
    </Shell>
  ),
};

export const PrefixInputs: StoryObj = {
  name: 'PrefixInput + IconField',
  render: () => (
    <Shell>
      <div className="grid max-w-md gap-5 rounded-2xl border border-white/10 bg-[#0e1116]/90 p-6">
        <PrefixInput
          label="Profile URL"
          name="slug"
          prefix="career.dev/p/"
          placeholder="your-profile-name"
          hint="Lowercase letters, numbers, and hyphens only."
        />
        <PrefixInput
          label="GitHub"
          name="github"
          prefix="github.com/"
          placeholder="username"
          error="Enter a valid GitHub username"
        />
        <IconField
          label="Phone"
          name="phone"
          icon={<Phone className="size-4" aria-hidden />}
          placeholder="+1 555 0100"
        />
      </div>
    </Shell>
  ),
};
