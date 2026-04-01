import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';

import { TextAreaField } from './text-area-field';

const meta: Meta<typeof TextAreaField> = {
  title: 'Compound/TextAreaField',
  component: TextAreaField,
  tags: ['autodocs'],
  argTypes: {
    disabled: { control: 'boolean' },
    rows: { control: 'number' },
  },
};

export default meta;
type Story = StoryObj<typeof TextAreaField>;

export const Default: Story = {
  args: {
    label: 'Notes',
    placeholder: 'Enter your notes here',
    rows: 4,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const textarea = canvas.getByLabelText('Notes') as HTMLTextAreaElement;

    await userEvent.click(textarea);
    await userEvent.type(textarea, 'Sample note content');

    await expect(textarea).toHaveValue('Sample note content');
    await expect(textarea).toHaveFocus();
  },
};

export const WithHelpText: Story = {
  args: {
    label: 'Description',
    helpText: 'Markdown formatting is supported',
    placeholder: 'Write a detailed description...',
    rows: 5,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText('Markdown formatting is supported')).toBeInTheDocument();
  },
};

export const Error: Story = {
  args: {
    label: 'Message',
    error: 'Message is required and cannot be empty',
    placeholder: 'Write something...',
    rows: 3,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole('alert')).toHaveTextContent(
      'Message is required and cannot be empty',
    );
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    label: 'Archived Notes',
    placeholder: 'This field is disabled',
    rows: 4,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const textarea = canvas.getByLabelText('Archived Notes');

    await expect(textarea).toBeDisabled();
  },
};

export const LargeField: Story = {
  args: {
    label: 'Long Form Content',
    helpText: 'Use this field for extended writing',
    placeholder: 'Write as much as you need...',
    rows: 8,
  },
};
