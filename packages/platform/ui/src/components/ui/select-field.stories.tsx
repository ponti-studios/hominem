import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';

import { SelectField } from './select-field';

const meta: Meta<typeof SelectField> = {
  title: 'Forms/SelectField',
  component: SelectField,
  tags: ['autodocs'],
  argTypes: {
    disabled: { control: 'boolean' },
    required: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof SelectField>;

const defaultOptions = [
  { label: 'Option A', value: 'a' },
  { label: 'Option B', value: 'b' },
  { label: 'Option C', value: 'c' },
];

export const Default: Story = {
  args: {
    label: 'Choose an option',
    placeholder: 'Select...',
    options: defaultOptions,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText('Choose an option')).toBeInTheDocument();
  },
};

export const WithHelpText: Story = {
  args: {
    label: 'Priority',
    helpText: 'Select the task priority level',
    placeholder: 'Pick a priority',
    options: [
      { label: 'Low', value: 'low' },
      { label: 'Medium', value: 'medium' },
      { label: 'High', value: 'high' },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText('Select the task priority level')).toBeInTheDocument();
  },
};

export const Required: Story = {
  args: {
    label: 'Status',
    required: true,
    placeholder: 'Select status',
    options: [
      { label: 'Active', value: 'active' },
      { label: 'Inactive', value: 'inactive' },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const label = canvas.getByText('Status');

    // Check for asterisk indicating required
    await expect(label.textContent).toContain('*');
  },
};

export const Error: Story = {
  args: {
    label: 'Category',
    error: 'Please select a category',
    options: defaultOptions,
    placeholder: 'Choose...',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole('alert')).toHaveTextContent('Please select a category');
  },
};

export const Disabled: Story = {
  args: {
    label: 'Disabled Select',
    disabled: true,
    placeholder: 'Cannot select',
    options: defaultOptions,
  },
};

export const WithDisabledOptions: Story = {
  args: {
    label: 'Status',
    options: [
      { label: 'Available', value: 'available' },
      { label: 'Coming Soon', value: 'soon', disabled: true },
      { label: 'Deprecated', value: 'deprecated', disabled: true },
    ],
    placeholder: 'Select status',
  },
};
