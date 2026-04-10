import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { DatePicker } from './date-picker';

const meta = {
  title: 'Forms/DatePicker',
  component: DatePicker,
  tags: ['autodocs'],
} satisfies Meta<typeof DatePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    value: undefined,
    onSelect: () => {},
    placeholder: 'Pick a date',
  },
  render: (args) => {
    const [date, setDate] = useState<Date | undefined>(args.value);
    return <DatePicker {...args} value={date} onSelect={setDate} />;
  },
};

export const WithLabel: Story = {
  args: {
    value: new Date(),
    onSelect: () => {},
    label: 'Due Date',
    showLabel: true,
  },
  render: (args) => {
    const [date, setDate] = useState<Date | undefined>(args.value);
    return <DatePicker {...args} value={date} onSelect={setDate} />;
  },
};

export const Disabled: Story = {
  args: {
    value: new Date(),
    onSelect: () => {},
    disabled: true,
    label: 'Locked Date',
    showLabel: true,
  },
};
