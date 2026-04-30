import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { FilterSelect } from './filter-select';

const meta = {
  title: 'Patterns/Filters/FilterSelect',
  component: FilterSelect,
  tags: ['autodocs'],
  parameters: {
    controls: {
      disable: true,
    },
  },
} satisfies Meta<typeof FilterSelect>;

export default meta;
type Story = StoryObj<typeof meta>;

const statusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'pending', label: 'Pending' },
];

export const Default: Story = {
  args: {
    label: 'Status',
    value: '',
    options: statusOptions,
    onChange: () => {},
  },
  render: () => {
    const [value, setValue] = useState<string | ''>('');
    return (
      <FilterSelect
        label="Status"
        value={value}
        options={statusOptions}
        onChange={setValue}
        placeholder="All"
      />
    );
  },
};

export const WithSelection: Story = {
  args: {
    label: 'Status',
    value: 'active',
    options: statusOptions,
    onChange: () => {},
  },
  render: () => {
    const [value, setValue] = useState<string | ''>('active');
    return (
      <FilterSelect
        label="Status"
        value={value}
        options={statusOptions}
        onChange={setValue}
        placeholder="All"
      />
    );
  },
};

export const MultipleSelects: Story = {
  args: {
    label: 'Status',
    value: '',
    options: statusOptions,
    onChange: () => {},
  },
  render: () => {
    const [status, setStatus] = useState<string | ''>('');
    const [type, setType] = useState<string | ''>('');
    return (
      <div className="flex gap-4">
        <FilterSelect
          label="Status"
          value={status}
          options={statusOptions}
          onChange={setStatus}
          placeholder="All statuses"
        />
        <FilterSelect
          label="Type"
          value={type}
          options={[
            { value: 'invoice', label: 'Invoice' },
            { value: 'payment', label: 'Payment' },
            { value: 'refund', label: 'Refund' },
          ]}
          onChange={setType}
          placeholder="All types"
        />
      </div>
    );
  },
};
