import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';

import { booleanControl, numberControl, textControl } from '../../storybook/controls';
import { NumberInput } from './number-input';

const meta: Meta<typeof NumberInput> = {
  title: 'Primitives/NumberInput',
  component: NumberInput,
  tags: ['autodocs'],
  argTypes: {
    placeholder: textControl('Placeholder text shown when the field is empty'),
    maxLength: numberControl('Maximum number of digits allowed', { min: 1 }),
    error: booleanControl('Shows the error visual state', false),
    success: booleanControl('Shows the success visual state and locks editing', false),
    disabled: booleanControl('Prevents user interaction and applies disabled styling', false),
  },
};

export default meta;
type Story = StoryObj<typeof NumberInput>;

export const Default: Story = {
  args: {
    placeholder: 'Enter numbers only',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByDisplayValue('') as HTMLInputElement;

    await userEvent.click(input);
    await userEvent.type(input, '12345');

    await expect(input).toHaveValue('12345');
    await expect(input).toHaveFocus();
  },
};

export const WithMaxLength: Story = {
  args: {
    placeholder: '000000',
    maxLength: 6,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByDisplayValue('') as HTMLInputElement;

    await userEvent.type(input, '123456789');

    // Should be capped at maxLength
    await expect(input).toHaveValue('123456');
  },
};

export const ErrorState: Story = {
  args: {
    error: true,
    placeholder: 'Invalid input',
  },
};

export const SuccessState: Story = {
  args: {
    success: true,
    value: '12345',
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    placeholder: 'Disabled',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByDisplayValue('') as HTMLInputElement;

    await expect(input).toBeDisabled();
  },
};
