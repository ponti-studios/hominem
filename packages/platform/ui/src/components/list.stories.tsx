import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import { booleanControl, selectControl } from '../storybook/controls';
import { loadingSizeOptions } from '../storybook/options';
import { List } from './list';

const meta = {
  title: 'Primitives/List',
  component: List,
  tags: ['autodocs'],
  argTypes: {
    isLoading: booleanControl('Shows the loading state instead of the list content', false),
    loadingSize: selectControl(loadingSizeOptions, 'Size of the loading placeholder', {
      defaultValue: 'md',
    }),
  },
} satisfies Meta<typeof List>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    isLoading: false,
    loadingSize: 'md',
  },
  render: (args) => (
    <List {...args} className="max-w-sm">
      <li className="px-4 py-3 text-sm">Item one</li>
      <li className="px-4 py-3 text-sm">Item two</li>
      <li className="px-4 py-3 text-sm">Item three</li>
    </List>
  ),
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
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
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
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
  parameters: {
    controls: {
      disable: true,
    },
  },
};

export const WithContent: Story = {
  parameters: {
    controls: {
      disable: true,
    },
  },
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
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Alice Johnson')).toBeInTheDocument();
  },
};
