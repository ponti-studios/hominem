import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { OtpCodeInput } from './otp-code-input';

const meta = {
  title: 'Patterns/Auth/OtpCodeInput',
  component: OtpCodeInput,
  tags: ['autodocs'],
} satisfies Meta<typeof OtpCodeInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    value: '',
    onChange: () => {},
    autoFocus: false,
  },
  render: (args) => {
    const [value, setValue] = useState(args.value);
    return (
      <div className="max-w-xs">
        <OtpCodeInput {...args} value={value} onChange={setValue} />
      </div>
    );
  },
};

export const WithError: Story = {
  args: {
    value: '12',
    onChange: () => {},
    error: 'Invalid code. Please try again.',
    autoFocus: false,
  },
  render: (args) => (
    <div className="max-w-xs">
      <OtpCodeInput {...args} />
    </div>
  ),
};

export const Disabled: Story = {
  args: {
    value: '123456',
    onChange: () => {},
    disabled: true,
    autoFocus: false,
  },
  render: (args) => (
    <div className="max-w-xs">
      <OtpCodeInput {...args} />
    </div>
  ),
};

export const FourDigit: Story = {
  args: {
    value: '',
    onChange: () => {},
    length: 4,
    autoFocus: false,
  },
  render: (args) => {
    const [value, setValue] = useState(args.value);
    return (
      <div className="max-w-xs">
        <OtpCodeInput {...args} value={value} onChange={setValue} />
      </div>
    );
  },
};
