import type { Meta, StoryObj } from '@storybook/react-vite';
import { MemoryRouter } from 'react-router';
import { expect, userEvent, within } from 'storybook/test';

import { EmailEntryForm } from './email-entry-form';

const meta = {
  title: 'Patterns/Auth/EmailEntryForm',
  component: EmailEntryForm,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof EmailEntryForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onSubmit: async () => {},
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText('Email address') as HTMLInputElement;

    await userEvent.type(input, 'test@example.com');
    await expect(input).toHaveValue('test@example.com');
    await expect(canvas.getByRole('heading', { name: 'Remember everything.' })).toBeInTheDocument();
  },
};

export const WithError: Story = {
  args: {
    error: 'Please enter a valid email address.',
    onSubmit: async () => {},
  },
};

export const WithPasskey: Story = {
  args: {
    onSubmit: async () => {},
    onPasskeyClick: async () => {},
  },
};
