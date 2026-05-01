import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import { ResendCodeButton } from './resend-code-button';

const meta = {
  title: 'Patterns/Auth/ResendCodeButton',
  component: ResendCodeButton,
  tags: ['autodocs'],
} satisfies Meta<typeof ResendCodeButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onResend: () => undefined,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole('button', { name: /resend code/i })).toBeInTheDocument();
  },
};

export const WithCooldown: Story = {
  args: {
    onResend: () => undefined,
    cooldownSeconds: 45,
  },
};

export const Loading: Story = {
  args: {
    onResend: () => undefined,
    isLoading: true,
  },
};
