import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ComponentProps } from "react";
import { expect, userEvent, within } from "storybook/test";

import { booleanControl, numberControl, textControl } from "../storybook/controls";
import { Textarea } from "./textarea";

function TextareaField({
  error,
  helpText,
  id,
  label,
  ...props
}: ComponentProps<typeof Textarea> & {
  error?: string;
  helpText?: string;
  id: string;
  label: string;
}) {
  const helpId = helpText ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-foreground text-sm leading-none font-medium">
        {label}
      </label>
      <Textarea
        id={id}
        aria-describedby={[helpId, errorId].filter(Boolean).join(" ") || undefined}
        aria-invalid={error ? true : undefined}
        {...props}
      />
      {helpText ? (
        <p id={helpId} className="text-muted-foreground text-sm">
          {helpText}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const meta = {
  title: "Forms/Textarea",
  component: Textarea,
  tags: ["autodocs"],
  argTypes: {
    placeholder: textControl("Placeholder text shown when the textarea is empty"),
    rows: numberControl("Number of visible text lines", { min: 1, max: 20, defaultValue: 4 }),
    disabled: booleanControl("Prevents user interaction and applies disabled styling", false),
  },
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    placeholder: "Enter your notes here",
    rows: 4,
  },
  render: (args) => <TextareaField id="notes" label="Notes" {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const textarea = canvas.getByLabelText("Notes") as HTMLTextAreaElement;

    await userEvent.click(textarea);
    await userEvent.type(textarea, "Sample note content");

    await expect(textarea).toHaveValue("Sample note content");
    await expect(textarea).toHaveFocus();
  },
};

export const WithHelpText: Story = {
  args: {
    placeholder: "Write a detailed description...",
    rows: 5,
  },
  render: (args) => (
    <TextareaField
      id="description"
      label="Description"
      helpText="Markdown formatting is supported"
      {...args}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText("Markdown formatting is supported")).toBeInTheDocument();
  },
};

export const Error: Story = {
  args: {
    placeholder: "Write something...",
    rows: 3,
  },
  render: (args) => (
    <TextareaField
      id="message"
      label="Message"
      error="Message is required and cannot be empty"
      {...args}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole("alert")).toHaveTextContent(
      "Message is required and cannot be empty",
    );
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    placeholder: "This field is disabled",
    rows: 4,
  },
  render: (args) => <TextareaField id="archived-notes" label="Archived Notes" {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const textarea = canvas.getByLabelText("Archived Notes");

    await expect(textarea).toBeDisabled();
  },
};

export const LargeField: Story = {
  args: {
    placeholder: "Write as much as you need...",
    rows: 8,
  },
  render: (args) => (
    <TextareaField
      id="long-form-content"
      label="Long Form Content"
      helpText="Use this field for extended writing"
      {...args}
    />
  ),
};
