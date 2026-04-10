import type { Meta, StoryObj } from '@storybook/react-vite';

import { Spinner } from './spinner';

const meta = {
  title: 'Feedback/Spinner',
  component: Spinner,
  tags: ['autodocs'],
} satisfies Meta<typeof Spinner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Large: Story = {
  render: () => <Spinner className="size-8" />,
};

export const WithText: Story = {
  render: () => (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Spinner />
      <span>Loading...</span>
    </div>
  ),
};
