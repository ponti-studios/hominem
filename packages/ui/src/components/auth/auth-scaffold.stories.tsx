import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

import { AuthScaffold } from "./auth-scaffold";

const meta = {
  title: "Patterns/Auth/AuthScaffold",
  component: AuthScaffold,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof AuthScaffold>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: "Sign in",
    helperText: "Enter your email to continue.",
    children: (
      <div className="space-y-4">
        <input
          type="text"
          placeholder="Email"
          className="border-border-default w-full rounded-md border px-3 py-2 text-sm"
        />
        <input
          type="password"
          placeholder="Password"
          className="border-border-default w-full rounded-md border px-3 py-2 text-sm"
        />
        <button className="bg-accent w-full rounded-md px-4 py-2 text-sm font-medium text-white">
          Sign In
        </button>
      </div>
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText("Sign in")).toBeInTheDocument();
  },
};

export const WithoutHelperText: Story = {
  args: {
    title: "Create Account",
    children: (
      <div className="space-y-4">
        <input
          type="text"
          placeholder="Email"
          className="border-border-default w-full rounded-md border px-3 py-2 text-sm"
        />
        <button className="bg-accent w-full rounded-md px-4 py-2 text-sm font-medium text-white">
          Sign Up
        </button>
      </div>
    ),
  },
};

export const WithHelperText: Story = {
  args: {
    title: "Verify",
    helperText: "Code sent to you@example.com.",
    children: (
      <div className="space-y-4">
        <input
          type="email"
          placeholder="Email address"
          className="border-border-default w-full rounded-md border px-3 py-2 text-sm"
        />
        <button className="bg-accent w-full rounded-md px-4 py-2 text-sm font-medium text-white">
          Continue
        </button>
      </div>
    ),
  },
};

export const WithCustomContent: Story = {
  args: {
    title: "Multi-Step Verification",
    helperText: "Code sent to you@example.com.",
    children: (
      <div className="space-y-4">
        <div className="bg-elevated rounded-md p-4">
          <p className="text-text-secondary mb-2 text-sm">Code sent to your email</p>
          <div className="flex gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <input
                key={i}
                type="text"
                maxLength={1}
                className="border-border-default h-8 w-8 rounded-md border text-center text-sm"
              />
            ))}
          </div>
        </div>
        <button className="bg-accent w-full rounded-md px-4 py-2 text-sm font-medium text-white">
          Verify
        </button>
      </div>
    ),
  },
};
