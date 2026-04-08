import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { Calendar } from './calendar';

const meta = {
  title: 'Patterns/DataDisplay/Calendar',
  component: Calendar,
  tags: ['autodocs'],
} satisfies Meta<typeof Calendar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    const [date, setDate] = useState<Date | undefined>(new Date());
    return (
      <Calendar mode="single" selected={date} onSelect={setDate} className="rounded-md border" />
    );
  },
};

export const WithoutOutsideDays: Story = {
  render: () => <Calendar mode="single" showOutsideDays={false} className="rounded-md border" />,
};

export const RangeMode: Story = {
  render: () => <Calendar mode="range" className="rounded-md border" />,
};
