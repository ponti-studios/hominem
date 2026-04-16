import type { Meta, StoryObj } from '@storybook/react-vite';
import { Plus, Trash2 } from 'lucide-react';
import { expect, userEvent, within } from 'storybook/test';

import { booleanControl, selectControl } from '../storybook/controls';
import { buttonSizeOptions, buttonVariantOptions } from '../storybook/options';
import { Button } from './button';

const meta = {
  title: 'Primitives/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: selectControl(buttonVariantOptions, 'Visual style variant of the button', {
      defaultValue: 'default',
    }),
    size: selectControl(buttonSizeOptions, 'Size variant of the button', {
      defaultValue: 'md',
    }),
    disabled: booleanControl('Prevents user interaction and applies disabled styling', false),
    isLoading: booleanControl('Shows the button in a loading state', false),
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { children: 'Button' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: 'Button' });

    await userEvent.hover(button);
    await userEvent.click(button);

    await expect(button).toHaveFocus();
    await expect(button).toBeEnabled();
  },
};

export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Button variant="default">Default</Button>
      <Button variant="primary">Primary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="link">Link</Button>
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
      <Button size="icon">
        <Plus className="size-4" />
      </Button>
    </div>
  ),
};

export const WithIcon: Story = {
  render: () => (
    <div className="flex gap-3">
      <Button>
        <Plus className="size-4" />
        Create
      </Button>
      <Button variant="destructive">
        <Trash2 className="size-4" />
        Delete
      </Button>
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="flex gap-3">
      <Button disabled>Default</Button>
      <Button variant="outline" disabled>
        Outline
      </Button>
      <Button variant="destructive" disabled>
        Destructive
      </Button>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole('button', { name: 'Default' })).toBeDisabled();
    await expect(canvas.getByRole('button', { name: 'Outline' })).toBeDisabled();
    await expect(canvas.getByRole('button', { name: 'Destructive' })).toBeDisabled();
  },
};

export const Loading: Story = {
  args: {
    children: 'Saving',
    isLoading: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: 'Saving' });

    await expect(button).toBeDisabled();
  },
};
