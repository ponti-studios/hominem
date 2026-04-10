import type { Meta, StoryObj } from '@storybook/react-vite';

import { SurfaceFrame } from './surface-frame';

const meta = {
  title: 'Surfaces/SurfaceFrame',
  component: SurfaceFrame,
  tags: ['autodocs'],
} satisfies Meta<typeof SurfaceFrame>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <SurfaceFrame className="p-5">
      <div className="space-y-2">
        <h3 className="text-base font-semibold text-foreground">Bounded surface</h3>
        <p className="text-sm text-text-secondary">
          Use for scroll regions, side panes, inspectors, and framed sections.
        </p>
      </div>
    </SurfaceFrame>
  ),
};

export const Elevated: Story = {
  render: () => (
    <SurfaceFrame elevated className="p-5">
      <div className="space-y-2">
        <h3 className="text-base font-semibold text-foreground">Elevated surface</h3>
        <p className="text-sm text-text-secondary">A slightly more distinct frame for emphasis.</p>
      </div>
    </SurfaceFrame>
  ),
};
