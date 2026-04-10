import type { Meta, StoryObj } from '@storybook/react-vite';

import { Slider } from './slider';

const meta = {
  title: 'Forms/Slider',
  component: Slider,
  tags: ['autodocs'],
} satisfies Meta<typeof Slider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <Slider defaultValue={[50]} max={100} step={1} className="w-64" />,
};

export const Range: Story = {
  render: () => <Slider defaultValue={[25, 75]} max={100} step={1} className="w-64" />,
};

export const WithSteps: Story = {
  render: () => <Slider defaultValue={[50]} max={100} step={10} className="w-64" />,
};

export const Disabled: Story = {
  render: () => <Slider defaultValue={[40]} max={100} step={1} disabled className="w-64" />,
};
