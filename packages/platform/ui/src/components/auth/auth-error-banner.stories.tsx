import type { Meta, StoryObj } from '@storybook/react-vite';

import { AuthErrorBanner } from './auth-error-banner';

const meta = {
  title: 'Patterns/Auth/AuthErrorBanner',
  component: AuthErrorBanner,
  tags: ['autodocs'],
} satisfies Meta<typeof AuthErrorBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    error: 'Invalid email or password',
  },
};

export const SessionExpired: Story = {
  args: {
    error: 'Your session has expired. Please sign in again.',
  },
};

export const NoError: Story = {
  args: {
    error: null,
  },
};
