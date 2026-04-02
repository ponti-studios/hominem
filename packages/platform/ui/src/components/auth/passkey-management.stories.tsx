import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import { PasskeyManagement } from './passkey-management';

const meta: Meta<typeof PasskeyManagement> = {
  title: 'Patterns/Auth/PasskeyManagement',
  component: PasskeyManagement,
  tags: ['autodocs'],
  argTypes: {
    isLoading: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof PasskeyManagement>;

export const Default: Story = {
  args: {
    passkeys: [
      { id: '1', name: 'MacBook Pro', createdAt: '2024-01-15T10:00:00Z' },
      { id: '2', name: 'iPhone', createdAt: '2024-02-01T14:30:00Z' },
    ],
    onAdd: async () => true,
    onDelete: async () => true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText('MacBook Pro')).toBeInTheDocument();
    await expect(canvas.getByText('iPhone')).toBeInTheDocument();
  },
};

export const Empty: Story = {
  args: {
    passkeys: [],
    onAdd: async () => true,
    onDelete: async () => true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Should show "Add passkey" option when no passkeys exist
    const addButton = canvas.queryByText(/add|register/i);
    await expect(addButton).toBeInTheDocument();
  },
};

export const Loading: Story = {
  args: {
    isLoading: true,
    onAdd: async () => true,
    onDelete: async () => true,
  },
};

export const WithError: Story = {
  args: {
    passkeys: [],
    error: 'Failed to load passkeys. Please try again.',
    onAdd: async () => true,
    onDelete: async () => true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText(/Failed to load passkeys/i)).toBeInTheDocument();
  },
};

export const SinglePasskey: Story = {
  args: {
    passkeys: [{ id: '1', name: 'My Security Key' }],
    onAdd: async () => true,
    onDelete: async () => true,
  },
};
