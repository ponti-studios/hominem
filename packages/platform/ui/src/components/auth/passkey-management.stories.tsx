import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import { PasskeyManagement } from './passkey-management';

const meta = {
  title: 'Patterns/Auth/PasskeyManagement',
  component: PasskeyManagement,
  tags: ['autodocs'],
  argTypes: {
    isLoading: { control: 'boolean' },
  },
} satisfies Meta<typeof PasskeyManagement>;

export default meta;
type Story = StoryObj<typeof meta>;

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

    await expect(canvas.getByRole('heading', { name: 'Passkeys' })).toBeInTheDocument();
    await expect(canvas.getByRole('list', { name: 'Registered passkeys' })).toBeInTheDocument();
    await expect(canvas.getAllByRole('listitem')).toHaveLength(2);
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
    await expect(canvas.getByRole('heading', { name: 'Passkeys' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Add a passkey' })).toBeInTheDocument();
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

    await expect(canvas.getByRole('alert')).toHaveTextContent(
      'Failed to load passkeys. Please try again.',
    );
  },
};

export const SinglePasskey: Story = {
  args: {
    passkeys: [{ id: '1', name: 'My Security Key' }],
    onAdd: async () => true,
    onDelete: async () => true,
  },
};
