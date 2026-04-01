import type { Meta, StoryObj } from '@storybook/react-vite';

import { Textarea } from './textarea';

const meta: Meta<typeof Textarea> = {
  title: 'Forms/Textarea',
  component: Textarea,
  tags: ['autodocs'],
  argTypes: {
    placeholder: {
      control: 'text',
      description: 'Placeholder text shown when the textarea is empty',
    },
    disabled: {
      control: 'boolean',
      description: 'Prevents user interaction and applies disabled styling',
      table: { defaultValue: { summary: 'false' } },
    },
    rows: {
      control: { type: 'number', min: 1, max: 20 },
      description: 'Number of visible text lines',
      table: { defaultValue: { summary: '3' } },
    },
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
