import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import { AuthScaffold } from './auth-scaffold';

const meta: Meta<typeof AuthScaffold> = {
  title: 'Patterns/Auth/AuthScaffold',
  component: AuthScaffold,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof AuthScaffold>;

export const Default: Story = {
  args: {
    title: 'Sign in',
    helper: 'We’ll send a code to your email.',
    children: (
      <div className="space-y-4">
        <input
          type="text"
          placeholder="Email"
          className="w-full px-3 py-2 border border-border-default rounded-md text-sm"
        />
        <input
          type="password"
          placeholder="Password"
          className="w-full px-3 py-2 border border-border-default rounded-md text-sm"
        />
        <button className="w-full px-4 py-2 bg-accent text-white font-medium rounded-md text-sm">
          Sign In
        </button>
      </div>
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText('Sign in')).toBeInTheDocument();
    await expect(canvas.getByText('We’ll send a code to your email.')).toBeInTheDocument();
  },
};

export const WithoutDescription: Story = {
  args: {
    title: 'Create Account',
    children: (
      <div className="space-y-4">
        <input
          type="text"
          placeholder="Email"
          className="w-full px-3 py-2 border border-border-default rounded-md text-sm"
        />
        <button className="w-full px-4 py-2 bg-accent text-white font-medium rounded-md text-sm">
          Sign Up
        </button>
      </div>
    ),
  },
};

export const WithLogo: Story = {
  args: {
    title: 'Verify',
    helper: 'Code sent to you@example.com.',
    logo: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Ccircle cx="50" cy="50" r="40" fill="%23007aff"/%3E%3C/svg%3E',
    children: (
      <div className="space-y-4">
        <input
          type="email"
          placeholder="Email address"
          className="w-full px-3 py-2 border border-border-default rounded-md text-sm"
        />
        <button className="w-full px-4 py-2 bg-accent text-white font-medium rounded-md text-sm">
          Continue
        </button>
      </div>
    ),
  },
};

export const WithCustomContent: Story = {
  args: {
    title: 'Multi-Step Verification',
    helper: 'Code sent to you@example.com.',
    children: (
      <div className="space-y-4">
        <div className="p-4 bg-elevated rounded-md">
          <p className="text-sm text-text-secondary mb-2">Code sent to your email</p>
          <div className="flex gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <input
                key={i}
                type="text"
                maxLength={1}
                className="w-8 h-8 text-center border border-border-default rounded-md text-sm"
              />
            ))}
          </div>
        </div>
        <button className="w-full px-4 py-2 bg-accent text-white font-medium rounded-md text-sm">
          Verify
        </button>
      </div>
    ),
  },
};
