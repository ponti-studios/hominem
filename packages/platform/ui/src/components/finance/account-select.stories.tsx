import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useState } from 'react';

import {
  booleanControl,
  hiddenControl,
  selectControl,
  textControl,
} from '../../storybook/controls';
import { AccountSelect, type AccountOption } from './account-select';

const accounts: AccountOption[] = [
  { id: 'all-checking', name: 'Daily Checking' },
  { id: 'travel-card', name: 'Travel Rewards Card' },
  { id: 'savings', name: 'Emergency Savings' },
];

const accountOptions = ['all', ...accounts.map((account) => account.id)] as const;

const meta = {
  title: 'Patterns/Finance/AccountSelect',
  component: AccountSelect,
  tags: ['autodocs'],
  argTypes: {
    selectedAccount: selectControl(accountOptions, 'Currently selected account', {
      defaultValue: 'all',
    }),
    isLoading: booleanControl('Shows the loading placeholder state', false),
    placeholder: textControl('Placeholder text shown when no account is selected'),
    label: textControl('Label displayed above the select when shown'),
    showLabel: booleanControl('Shows the select label above the control', false),
    accounts: hiddenControl,
    onAccountChange: hiddenControl,
    className: hiddenControl,
  },
  args: {
    selectedAccount: 'all',
    accounts,
    isLoading: false,
    placeholder: 'All accounts',
    label: 'Account',
    showLabel: false,
    onAccountChange: () => {},
  },
  render: (args) => {
    const [selectedAccount, setSelectedAccount] = useState(args.selectedAccount);

    useEffect(() => {
      setSelectedAccount(args.selectedAccount);
    }, [args.selectedAccount]);

    return (
      <AccountSelect
        {...args}
        selectedAccount={selectedAccount}
        onAccountChange={setSelectedAccount}
      />
    );
  },
} satisfies Meta<typeof AccountSelect>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithLabel: Story = {
  args: {
    showLabel: true,
    onAccountChange: () => {},
  },
};

export const Loading: Story = {
  args: {
    accounts: [],
    isLoading: true,
    showLabel: true,
    onAccountChange: () => {},
  },
};

export const Empty: Story = {
  args: {
    accounts: [],
    showLabel: true,
    onAccountChange: () => {},
  },
};
