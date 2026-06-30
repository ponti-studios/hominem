import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState, type ComponentProps } from "react";
import { expect, userEvent, within } from "storybook/test";

import { EmailEntryForm } from "./email-entry-form";

const meta = {
  title: "Patterns/Auth/EmailEntryForm",
  component: EmailEntryForm,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof EmailEntryForm>;

export default meta;
type Story = StoryObj<typeof meta>;

function ControlledEmailEntryForm(args: ComponentProps<typeof EmailEntryForm>) {
  const [email, setEmail] = useState(args.email);

  return <EmailEntryForm {...args} email={email} onEmailChange={setEmail} />;
}

export const Default: Story = {
  args: {
    email: "",
    onEmailChange: () => {},
    onSubmit: async () => {},
  },
  render: (args) => <ControlledEmailEntryForm {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText("Email address") as HTMLInputElement;

    await userEvent.type(input, "test@example.com");
    await expect(input).toHaveValue("test@example.com");
  },
};

export const WithError: Story = {
  args: {
    email: "",
    error: "Please enter a valid email address.",
    onEmailChange: () => {},
    onSubmit: async () => {},
  },
};

export const WithPasskey: Story = {
  args: {
    email: "",
    onEmailChange: () => {},
    onSubmit: async () => {},
    onPasskeyClick: async () => {},
  },
};
