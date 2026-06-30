import type { Meta, StoryObj } from "@storybook/react-vite";
import * as React from "react";

import { Input } from "./input";
import { Label } from "./label";

const meta: Meta<typeof Label> = {
  title: "Internal/UI/Label",
  component: Label,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: "Email address",
  },
};

export const WithInput: Story = {
  render: () => (
    <div className="flex w-full max-w-sm flex-col gap-2">
      <Label htmlFor="email">Email address</Label>
      <Input id="email" type="email" placeholder="you@example.com" />
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="flex w-full max-w-sm flex-col gap-2">
      <Label htmlFor="disabled-field">Subscription plan</Label>
      <div className="flex items-center gap-3">
        <Input id="disabled-field" className="peer" disabled placeholder="Enterprise" />
        <Label htmlFor="disabled-field" className="shrink-0">
          (locked)
        </Label>
      </div>
      <p className="text-muted-foreground text-xs">
        The <code className="font-mono">peer-disabled</code> variant mutes the label when its paired
        input is disabled.
      </p>
    </div>
  ),
};
