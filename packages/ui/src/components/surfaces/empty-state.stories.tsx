import type { Meta, StoryObj } from '@storybook/react-vite';
import { SearchIcon, SparklesIcon } from 'lucide-react';

import { Button } from '../button';
import { EmptyState } from './empty-state';

const meta = {
  title: 'Surfaces/EmptyState',
  component: EmptyState,
  tags: ['autodocs'],
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    icon: <SparklesIcon className="size-5" />,
    title: 'No chats yet',
    description: 'Start a conversation and your recent chats will appear here.',
    action: <Button size="sm">New chat</Button>,
    variant: 'dashed',
  },
};

export const Search: Story = {
  args: {
    icon: <SearchIcon className="size-5" />,
    title: 'No results found',
    description: 'Try adjusting your filters or search terms.',
    variant: 'search',
  },
};
