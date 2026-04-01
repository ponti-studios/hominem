import type { Meta, StoryObj } from '@storybook/react-vite';

import { Input } from './input';
import { Label } from './label';
import { Textarea } from './textarea';

const meta: Meta<typeof Input> = {
  title: 'Forms/Input',
  component: Input,
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: 'select',
      options: ['text', 'email', 'password', 'search', 'number', 'tel', 'url'],
      description: 'HTML input type attribute',
      table: { defaultValue: { summary: 'text' } },
    },
    placeholder: {
      control: 'text',
      description: 'Placeholder text shown when the input is empty',
    },
    disabled: {
      control: 'boolean',
      description: 'Prevents user interaction and applies disabled styling',
      table: { defaultValue: { summary: 'false' } },
    },
  },
};
export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: { placeholder: 'Enter text…' },
};

export const WithLabel: Story = {
  render: () => (
    <div className="flex flex-col gap-2 w-72">
      <Label htmlFor="email">Email</Label>
      <Input id="email" type="email" placeholder="you@example.com" />
    </div>
  ),
};

export const States: Story = {
  render: () => (
    <div className="flex flex-col gap-4 w-72">
      <Input placeholder="Default" />
      <Input placeholder="Disabled" disabled />
      <Input defaultValue="With value" />
    </div>
  ),
};

export const TextareaStory: Story = {
  name: 'Textarea',
  render: () => (
    <div className="flex flex-col gap-2 w-72">
      <Label htmlFor="notes">Notes</Label>
      <Textarea id="notes" placeholder="Write something…" rows={4} />
    </div>
  ),
};
