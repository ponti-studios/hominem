import type { Meta, StoryObj } from '@storybook/react-vite';

import { Progress } from './progress';

const meta = {
  title: 'Feedback/Progress',
  component: Progress,
  tags: ['autodocs'],
} satisfies Meta<typeof Progress>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    value: 60,
  },
};

export const Empty: Story = {
  args: { value: 0 },
};

export const Complete: Story = {
  args: { value: 100 },
};

export const Partial: Story = {
  render: () => (
    <div className="flex flex-col gap-4 w-64">
      <Progress value={10} />
      <Progress value={33} />
      <Progress value={66} />
      <Progress value={90} />
    </div>
  ),
};
