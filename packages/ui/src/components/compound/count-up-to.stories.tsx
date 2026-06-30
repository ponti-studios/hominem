import type { Meta, StoryObj } from "@storybook/react-vite";
import * as React from "react";

import { CountUpTo } from "./count-up-to";

const meta: Meta<typeof CountUpTo> = {
  title: "Patterns/DataDisplay/CountUpTo",
  component: CountUpTo,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="flex items-center justify-center">
        <span className="text-5xl font-light tabular-nums">
          <Story />
        </span>
      </div>
    ),
  ],
  argTypes: {
    value: { control: { type: "number" } },
    duration: { control: { type: "number" } },
    separator: { control: { type: "text" } },
    prefix: { control: { type: "text" } },
    suffix: { control: { type: "text" } },
    decimals: { control: { type: "number" } },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    value: 1000,
  },
};

export const WithPrefix: Story = {
  args: {
    value: 4999,
    prefix: "$",
  },
};

export const WithSuffix: Story = {
  args: {
    value: 75,
    suffix: "%",
  },
};

export const WithDecimals: Story = {
  args: {
    value: 3.14159,
    decimals: 2,
  },
};

export const LargeNumber: Story = {
  args: {
    value: 1000000,
    duration: 2,
  },
};

export const Fast: Story = {
  args: {
    value: 100,
    duration: 0.5,
  },
};
