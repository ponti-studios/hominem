import type { Meta, StoryObj } from '@storybook/react-vite';
import { Home, Settings, MessageSquare } from 'lucide-react';
import { expect, within } from 'storybook/test';

import { Header, type HeaderProps } from './header';

const meta: Meta<typeof Header> = {
  title: 'Layout/Header',
  component: Header,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    // Mock router to avoid routing errors in Storybook
  },
  decorators: [
    (Story) => (
      // Wrapper to provide router context mock
      <div className="min-h-screen bg-surface">
        <Story />
        <div className="h-20" />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Header>;

const navItems: HeaderProps['navItems'] = [
  { title: 'Home', url: '/home', icon: Home },
  { title: 'Chat', url: '/chat', icon: MessageSquare },
  { title: 'Settings', url: '/settings', icon: Settings },
];

export const Default: Story = {
  args: {
    navItems,
    brandIcon: <span className="text-lg font-bold">🏠</span>,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole('banner')).toBeInTheDocument();
  },
};

export const WithoutNavItems: Story = {
  args: {
    navItems: [],
    brandIcon: <span className="text-lg font-bold">App</span>,
  },
};

export const WithMultipleNavItems: Story = {
  args: {
    navItems: [
      { title: 'Dashboard', url: '/dashboard', icon: Home },
      { title: 'Notes', url: '/notes', icon: MessageSquare },
      { title: 'Search', url: '/search' },
      { title: 'Settings', url: '/settings', icon: Settings },
    ],
    brandIcon: <span className="text-lg font-bold">📝</span>,
  },
};

export const MinimalHeader: Story = {
  args: {
    navItems: [{ title: 'Home', url: '/home' }],
  },
};
