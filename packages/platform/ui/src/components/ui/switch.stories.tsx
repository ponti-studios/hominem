import type { Meta, StoryObj } from '@storybook/react-vite';

import { Label } from './label';
import { Switch } from './switch';

const meta: Meta<typeof Switch> = {
  title: 'Forms/Switch',
  component: Switch,
  tags: ['autodocs'],
  argTypes: {
    checked: {
      control: 'boolean',
      description: 'Controlled on/off state of the switch',
    },
    defaultChecked: {
      control: 'boolean',
      description: 'Initial checked state for uncontrolled usage',
      table: { defaultValue: { summary: 'false' } },
    },
    disabled: {
      control: 'boolean',
      description: 'Prevents user interaction and applies disabled styling',
      table: { defaultValue: { summary: 'false' } },
    },
    size: {
      control: 'select',
      options: ['default', 'sm'],
      description: 'Size variant of the switch',
      table: { defaultValue: { summary: 'default' } },
    },
    onCheckedChange: {
      action: 'checkedChange',
      description: 'Callback fired when the checked state changes',
    },
  },
};
export default meta;
type Story = StoryObj<typeof Switch>;

export const Default: Story = {};

export const WithLabel: Story = {
  render: () => (
    <div className="flex items-center space-x-2">
      <Switch id="airplane-mode" />
      <Label htmlFor="airplane-mode">Airplane Mode</Label>
    </div>
  ),
};

export const Checked: Story = {
  render: () => (
    <div className="flex items-center space-x-2">
      <Switch id="notifications" defaultChecked />
      <Label htmlFor="notifications">Enable Notifications</Label>
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <div className="flex items-center space-x-2">
        <Switch id="disabled-off" disabled />
        <Label htmlFor="disabled-off">Disabled off</Label>
      </div>
      <div className="flex items-center space-x-2">
        <Switch id="disabled-on" disabled defaultChecked />
        <Label htmlFor="disabled-on">Disabled on</Label>
      </div>
    </div>
  ),
};

export const Small: Story = {
  render: () => (
    <div className="flex items-center space-x-2">
      <Switch size="sm" id="small" />
      <Label htmlFor="small">Small switch</Label>
    </div>
  ),
};
