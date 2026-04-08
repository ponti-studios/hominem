import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useState } from 'react';

import { booleanControl, selectControl } from '../../storybook/controls';
import { switchSizeOptions } from '../../storybook/options';
import { Label } from './label';
import { Switch } from './switch';

const meta = {
  title: 'Forms/Switch',
  component: Switch,
  tags: ['autodocs'],
  argTypes: {
    checked: booleanControl('Controlled on/off state of the switch', false),
    disabled: booleanControl('Prevents user interaction and applies disabled styling', false),
    size: selectControl(switchSizeOptions, 'Size variant of the switch', {
      defaultValue: 'default',
    }),
  },
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

function SwitchPreview({
  checked,
  disabled = false,
  id,
  label,
  size = 'default',
}: {
  checked: boolean;
  disabled: boolean;
  id: string;
  label: string;
  size: 'default' | 'sm';
}) {
  const [currentChecked, setCurrentChecked] = useState(checked);

  useEffect(() => {
    setCurrentChecked(checked);
  }, [checked]);

  return (
    <div className="flex items-center space-x-2">
      <Switch
        id={id}
        checked={currentChecked}
        disabled={disabled}
        onCheckedChange={setCurrentChecked}
        size={size}
      />
      <Label htmlFor={id}>{label}</Label>
    </div>
  );
}

export const Default: Story = {
  args: {
    checked: false,
  },
  render: (args) => (
    <SwitchPreview
      checked={args.checked ?? false}
      disabled={args.disabled ?? false}
      id="switch-default"
      label="Airplane Mode"
      size={args.size ?? 'default'}
    />
  ),
};

export const WithLabel: Story = {
  args: {
    checked: false,
    size: 'default',
  },
  render: (args) => (
    <SwitchPreview
      checked={args.checked ?? false}
      disabled={args.disabled ?? false}
      id="airplane-mode"
      label="Airplane Mode"
      size={args.size ?? 'default'}
    />
  ),
};

export const Checked: Story = {
  args: {
    checked: true,
  },
  render: (args) => (
    <SwitchPreview
      checked={args.checked ?? true}
      disabled={args.disabled ?? false}
      id="notifications"
      label="Enable Notifications"
      size={args.size ?? 'default'}
    />
  ),
};

export const Disabled: Story = {
  args: {
    checked: false,
    disabled: true,
  },
  render: (args) => (
    <div className="flex flex-col gap-3">
      <SwitchPreview
        checked={args.checked ?? false}
        disabled={args.disabled ?? false}
        id="disabled-off"
        label="Disabled off"
        size={args.size ?? 'default'}
      />
      <SwitchPreview
        checked
        disabled={args.disabled ?? false}
        id="disabled-on"
        label="Disabled on"
        size={args.size ?? 'default'}
      />
    </div>
  ),
};

export const Small: Story = {
  args: {
    checked: false,
    size: 'sm',
  },
  render: (args) => (
    <SwitchPreview
      checked={args.checked ?? false}
      disabled={args.disabled ?? false}
      id="small"
      label="Small switch"
      size={args.size ?? 'default'}
    />
  ),
};
