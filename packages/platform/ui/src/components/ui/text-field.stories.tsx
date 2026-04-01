import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';

import { TextField } from './text-field';

const meta: Meta<typeof TextField> = {
  title: 'Forms/TextField',
  component: TextField,
  tags: ['autodocs'],
  argTypes: {
    label: textControl('Label displayed above the field'),
    type: selectControl(textFieldTypeOptions, 'Input type used by the field', {
      defaultValue: 'text',
    }),
    placeholder: textControl('Placeholder text shown when the field is empty'),
    helpText: textControl('Supporting text shown below the field'),
    error: textControl('Validation error text shown below the field'),
    disabled: booleanControl('Prevents user interaction and applies disabled styling', false),
    required: booleanControl('Marks the field as required for form submission', false),
  },
};

export default meta;
type Story = StoryObj<typeof TextField>;

export const Default: Story = {
  args: {
    label: 'Email',
    placeholder: 'you@example.com',
    type: 'email',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText('Email');

    await userEvent.click(input);
    await userEvent.type(input, 'you@example.com');

    await expect(input).toHaveFocus();
    await expect(input).toHaveValue('you@example.com');
  },
};

export const WithHelpText: Story = {
  args: {
    label: 'Search',
    helpText: 'Press Enter to submit',
    placeholder: 'Search notes',
    type: 'search',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText('Press Enter to submit')).toBeInTheDocument();
    await expect(canvas.getByLabelText('Search')).toBeEnabled();
  },
};

export const Error: Story = {
  args: {
    label: 'Password',
    error: 'Password is required',
    type: 'password',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText('Password');

    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(canvas.getByText('Password is required')).toBeInTheDocument();
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    label: 'Handle',
    placeholder: '@hominem',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByLabelText('Handle')).toBeDisabled();
  },
};
