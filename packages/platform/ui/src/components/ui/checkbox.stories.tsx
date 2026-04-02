import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useState } from 'react';

import { booleanControl, hiddenControl, selectControl } from '../../storybook/controls';
import { checkboxStateOptions } from '../../storybook/options';
import { Checkbox } from './checkbox';
import { Label } from './label';

const meta: Meta<typeof Checkbox> = {
  title: 'Forms/Checkbox',
  component: Checkbox,
  tags: ['autodocs'],
  argTypes: {
    checked: selectControl(checkboxStateOptions, 'Controlled checked state of the checkbox', {
      defaultValue: false,
    }),
    disabled: booleanControl('Prevents user interaction and applies disabled styling', false),
    onCheckedChange: hiddenControl,
  },
};
export default meta;
type Story = StoryObj<typeof Checkbox>;

function CheckboxPreview({
  checked,
  disabled = false,
  id,
  label,
}: {
  checked: boolean | 'indeterminate';
  disabled: boolean;
  id: string;
  label: string;
}) {
  const [currentChecked, setCurrentChecked] = useState<boolean | 'indeterminate'>(checked);

  useEffect(() => {
    setCurrentChecked(checked);
  }, [checked]);

  return (
    <div className="flex items-center gap-2">
      <Checkbox
        id={id}
        checked={currentChecked}
        disabled={disabled}
        onCheckedChange={setCurrentChecked}
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
    <CheckboxPreview
      checked={args.checked ?? false}
      disabled={args.disabled ?? false}
      id="terms"
      label="Accept terms and conditions"
    />
  ),
};

export const Checked: Story = {
  args: {
    checked: true,
  },
  render: (args) => (
    <CheckboxPreview
      checked={args.checked ?? true}
      disabled={args.disabled ?? false}
      id="checked"
      label="Already checked"
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
      <CheckboxPreview
        checked={args.checked ?? false}
        disabled={args.disabled ?? false}
        id="disabled"
        label="Disabled unchecked"
      />
      <CheckboxPreview
        checked="indeterminate"
        disabled={args.disabled ?? false}
        id="disabled-checked"
        label="Disabled checked"
      />
    </div>
  ),
};
