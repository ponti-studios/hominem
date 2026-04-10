import type { Meta, StoryObj } from '@storybook/react-vite';
import { Paperclip } from 'lucide-react';

import { MetaBadge } from './meta-badge';

const meta = {
  title: 'Surfaces/MetaBadge',
  component: MetaBadge,
  tags: ['autodocs'],
} satisfies Meta<typeof MetaBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: 'Files',
    icon: <Paperclip className="size-3" />,
  },
};

export const Subtle: Story = {
  args: {
    children: 'Draft',
    tone: 'subtle',
  },
};
