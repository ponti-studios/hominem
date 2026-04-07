import type { Meta, StoryObj } from '@storybook/react-vite';

import { selectControl } from '../../storybook/controls';
import { plaidStatusOptions } from '../../storybook/options';
import { PlaidStatusBadge } from './plaid-status-badge';

const meta = {
  title: 'Patterns/Finance/PlaidStatusBadge',
  component: PlaidStatusBadge,
  tags: ['autodocs'],
  argTypes: {
    status: selectControl(plaidStatusOptions, 'Plaid connection status shown in the badge', {
      defaultValue: 'active',
    }),
  },
  args: {
    status: 'active',
  },
} satisfies Meta<typeof PlaidStatusBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Active: Story = {};

export const Error: Story = {
  args: {
    status: 'error',
  },
};

export const PendingExpiration: Story = {
  args: {
    status: 'pending_expiration',
  },
};

export const Revoked: Story = {
  args: {
    status: 'revoked',
  },
};

export const Unknown: Story = {
  args: {
    status: null,
  },
};
