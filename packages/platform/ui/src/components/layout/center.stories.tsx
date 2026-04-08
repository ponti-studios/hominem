import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import { Center } from './center';

const meta = {
  title: 'Layout/Center',
  component: Center,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    maxWidth: {
      control: 'select',
      options: [undefined, 'sm', 'md', 'lg', 'xl', 'full'],
    },
  },
} satisfies Meta<typeof Center>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Center className="bg-surface p-8">
      <div className="rounded-lg border border-border-default bg-base p-8 text-center">
        <h2 className="text-xl font-semibold">Centered Content</h2>
        <p className="mt-2 text-text-secondary">
          This content is horizontally centered with margin-inline auto
        </p>
      </div>
    </Center>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText('Centered Content')).toBeInTheDocument();
  },
};

export const SmallWidth: Story = {
  render: () => (
    <Center maxWidth="sm" className="bg-surface p-8">
      <div className="rounded-lg border border-border-default bg-base p-6">
        <p className="text-sm">Small width constraint (42rem / 672px max)</p>
      </div>
    </Center>
  ),
};

export const MediumWidth: Story = {
  render: () => (
    <Center maxWidth="md" className="bg-surface p-8">
      <div className="rounded-lg border border-border-default bg-base p-6">
        <p className="text-sm">Medium width constraint (48rem / 768px max)</p>
      </div>
    </Center>
  ),
};

export const LargeWidth: Story = {
  render: () => (
    <Center maxWidth="lg" className="bg-surface p-8">
      <div className="rounded-lg border border-border-default bg-base p-6">
        <p className="text-sm">Large width constraint (64rem / 1024px max)</p>
      </div>
    </Center>
  ),
};

export const ExtraLargeWidth: Story = {
  render: () => (
    <Center maxWidth="xl" className="bg-surface p-8">
      <div className="rounded-lg border border-border-default bg-base p-6">
        <p className="text-sm">Extra-large width constraint (80rem / 1280px max)</p>
      </div>
    </Center>
  ),
};

export const FullWidth: Story = {
  render: () => (
    <Center maxWidth="full" className="bg-surface p-8">
      <div className="rounded-lg border border-border-default bg-base p-6">
        <p className="text-sm">Full width (100%)</p>
      </div>
    </Center>
  ),
};

export const SemanticElement: Story = {
  render: () => (
    <Center as="section" className="bg-surface p-8">
      <article className="rounded-lg border border-border-default bg-base p-6 max-w-md">
        <h2 className="font-semibold">Using Semantic HTML</h2>
        <p className="mt-2 text-sm text-text-secondary">
          This uses as=&quot;section&quot; for proper semantics
        </p>
      </article>
    </Center>
  ),
};
