import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import { List } from './list';

const meta: Meta<typeof List> = {
  title: 'Primitives/List',
  component: List,
  tags: ['autodocs'],
  argTypes: {
    isLoading: { control: 'boolean' },
    loadingSize: {
      control: 'select',
      options: ['sm', 'md', 'lg', 'xl', '2xl', '3xl'],
    },
  },
};
export default meta;
type Story = StoryObj<typeof List>;

export const Default: Story = {
  render: () => (
    <List className="max-w-sm">
      <li className="px-4 py-3 text-sm">Item one</li>
      <li className="px-4 py-3 text-sm">Item two</li>
      <li className="px-4 py-3 text-sm">Item three</li>
    </List>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Item one')).toBeInTheDocument();
    await expect(canvas.getByText('Item three')).toBeInTheDocument();
  },
};

export const Loading: Story = {
  args: {
    isLoading: true,
  },
  render: (args) => (
    <List {...args} className="max-w-sm">
      <li className="px-4 py-3 text-sm">This won't show</li>
    </List>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.queryByText("This won't show")).not.toBeInTheDocument();
  },
};

export const LoadingSmall: Story = {
  args: {
    isLoading: true,
    loadingSize: 'sm',
  },
  render: (args) => (
    <List {...args} className="max-w-sm">
      <li className="px-4 py-3 text-sm">Item</li>
    </List>
  ),
};

export const LoadingLarge: Story = {
  args: {
    isLoading: true,
    loadingSize: 'lg',
  },
  render: (args) => (
    <List {...args} className="max-w-sm">
      <li className="px-4 py-3 text-sm">Item</li>
    </List>
  ),
};

export const Empty: Story = {
  render: () => <List className="max-w-sm" />,
};

export const WithContent: Story = {
  render: () => (
    <List className="max-w-sm">
      {['Alice Johnson', 'Bob Smith', 'Carol Williams', 'David Brown'].map((name) => (
        <li key={name} className="px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
              {name[0]}
            </div>
            <span className="text-sm">{name}</span>
          </div>
        </li>
      ))}
    </List>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Alice Johnson')).toBeInTheDocument();
  },
};
