import type { Meta, StoryObj } from "@storybook/react-vite";

import { booleanControl, selectControl, textControl } from "../storybook/controls";
import { inputTypeOptions } from "../storybook/options";
import { Input } from "./input";

const meta = {
  title: "Forms/Input",
  component: Input,
  tags: ["autodocs"],
  argTypes: {
    type: selectControl(inputTypeOptions, "HTML input type attribute", {
      defaultValue: "text",
    }),
    placeholder: textControl("Placeholder text shown when the input is empty"),
    disabled: booleanControl("Prevents user interaction and applies disabled styling", false),
    required: booleanControl("Marks the input as required for form submission", false),
  },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { placeholder: "Enter text…" },
};

export const WithLabel: Story = {
  render: () => (
    <div className="flex w-72 flex-col gap-2">
      <label htmlFor="email" className="text-foreground text-sm leading-none font-medium">
        Email
      </label>
      <Input id="email" type="email" placeholder="you@example.com" />
    </div>
  ),
};

export const States: Story = {
  render: () => (
    <div className="flex w-72 flex-col gap-4">
      <Input placeholder="Default" />
      <Input placeholder="Disabled" disabled />
      <Input defaultValue="With value" />
    </div>
  ),
};
