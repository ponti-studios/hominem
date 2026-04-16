import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useState } from 'react';
import { expect, within } from 'storybook/test';

import { booleanControl, hiddenControl, textControl } from '../../storybook/controls';
import { SelectField } from './select-field';

const meta = {
  title: 'Forms/SelectField',
  component: SelectField,
  tags: ['autodocs'],
  argTypes: {
    label: textControl('Label displayed above the select'),
    placeholder: textControl('Placeholder text shown when the select is empty'),
    helpText: textControl('Supporting text shown below the select'),
    error: textControl('Validation error text shown below the select'),
    value: textControl('Selected option value'),
    disabled: booleanControl('Prevents user interaction and applies disabled styling', false),
    required: booleanControl('Marks the select as required for form submission', false),
    defaultValue: hiddenControl,
    options: hiddenControl,
    onValueChange: hiddenControl,
  },
} satisfies Meta<typeof SelectField>;

export default meta;
type Story = StoryObj<typeof meta>;

function SelectFieldPreview(props: Parameters<typeof SelectField>[0]) {
  const [value, setValue] = useState(props.value ?? props.defaultValue ?? '');

  useEffect(() => {
    setValue(props.value ?? props.defaultValue ?? '');
  }, [props.defaultValue, props.value]);

  return <SelectField {...props} value={value} onValueChange={setValue} />;
}

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
  render: (args) => <SelectFieldPreview {...args} />,
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole('combobox', { name: 'Choose an option' })).toBeInTheDocument();
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
  render: (args) => <SelectFieldPreview {...args} />,
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole('combobox', { name: 'Priority' })).toBeInTheDocument();
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
  render: (args) => <SelectFieldPreview {...args} />,
};

export const Error: Story = {
  args: {
    label: 'Category',
    error: 'Please select a category',
    options: defaultOptions,
    placeholder: 'Choose...',
  },
  render: (args) => <SelectFieldPreview {...args} />,
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
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
  render: (args) => <SelectFieldPreview {...args} />,
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
  render: (args) => <SelectFieldPreview {...args} />,
};
