import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';

// This is likely a form component for email entry in auth flow
const meta: Meta = {
  title: 'Patterns/Auth/EmailEntryForm',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <div className="max-w-md mx-auto p-6">
      <form className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Email Address</label>
          <input
            type="email"
            placeholder="you@example.com"
            className="w-full px-3 py-2 border border-border-default rounded-md text-sm"
          />
        </div>
        <button
          type="submit"
          className="w-full px-4 py-2 bg-accent text-white font-medium rounded-md text-sm"
        >
          Continue with Email
        </button>
      </form>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByPlaceholderText('you@example.com') as HTMLInputElement;

    await userEvent.type(input, 'test@example.com');
    await expect(input).toHaveValue('test@example.com');
  },
};

export const WithError: Story = {
  render: () => (
    <div className="max-w-md mx-auto p-6">
      <form className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Email Address</label>
          <input
            type="email"
            className="w-full px-3 py-2 border border-destructive rounded-md text-sm"
            defaultValue="invalid"
          />
          <p className="text-xs text-destructive mt-1">Please enter a valid email address</p>
        </div>
        <button
          type="submit"
          className="w-full px-4 py-2 bg-accent text-white font-medium rounded-md text-sm"
        >
          Continue with Email
        </button>
      </form>
    </div>
  ),
};
