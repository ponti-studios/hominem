import type { Meta, StoryObj } from '@storybook/react-vite';

import { LoadingSpinner } from './loading-spinner';

const meta = {
  title: 'Feedback/LoadingSpinner',
  component: LoadingSpinner,
  tags: ['autodocs'],
} satisfies Meta<typeof LoadingSpinner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    variant: 'md',
  },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <LoadingSpinner variant="sm" />
      <LoadingSpinner variant="md" />
      <LoadingSpinner variant="lg" />
      <LoadingSpinner variant="xl" />
    </div>
  ),
};
