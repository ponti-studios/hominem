import type { Meta, StoryObj } from '@storybook/react-vite';

import { booleanControl, numberControl, textControl } from '../../storybook/controls';
import { Textarea } from './textarea';

const meta: Meta<typeof Textarea> = {
  title: 'Forms/Textarea',
  component: Textarea,
  tags: ['autodocs'],
  argTypes: {
    placeholder: textControl('Placeholder text shown when the textarea is empty'),
    disabled: booleanControl('Prevents user interaction and applies disabled styling', false),
    required: booleanControl('Marks the textarea as required for form submission', false),
    rows: numberControl('Number of visible text lines', { min: 1, max: 20, defaultValue: 3 }),
  },
};
export default meta;
type Story = StoryObj<typeof Textarea>;

export const Default: Story = {
  args: {
    placeholder: 'Type your message here.',
  },
};

export const WithValue: Story = {
  args: {
    defaultValue: 'This is some pre-filled content in the textarea.',
  },
};

export const Disabled: Story = {
  args: {
    placeholder: 'Cannot edit this.',
    disabled: true,
  },
};

export const Invalid: Story = {
  args: {
    placeholder: 'Invalid state',
    'aria-invalid': true,
  },
};
