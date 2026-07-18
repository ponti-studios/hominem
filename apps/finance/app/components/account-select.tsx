import { EntitySelect } from '@ponti-studios/ui/forms';

import { useFinanceAccounts } from '~/lib/hooks/use-finance-data';

interface AccountSelectProps {
  selectedAccount: string;
  setSelectedAccount?: (value: string) => void;
  onAccountChange?: (value: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  label?: string;
  className?: string;
  showLabel?: boolean;
}

export function AccountSelect({
  selectedAccount,
  setSelectedAccount,
  onAccountChange,
  isLoading: externalLoading,
  placeholder = 'All accounts',
  label = 'Account',
  className,
  showLabel = false,
}: AccountSelectProps) {
  // Use external data if provided, otherwise fetch internally
  const { data: internalAccounts, isLoading: internalLoading } = useFinanceAccounts();
  const accounts = Array.isArray(internalAccounts) ? internalAccounts : [];
  const isLoading = externalLoading !== undefined ? externalLoading : internalLoading;

  // Support both prop naming conventions for backward compatibility
  const handleChange = onAccountChange || setSelectedAccount;

  if (!handleChange) {
    throw new Error('AccountSelect requires either setSelectedAccount or onAccountChange prop');
  }

  return (
    <EntitySelect
      value={selectedAccount}
      onValueChange={handleChange}
      options={accounts}
      isLoading={isLoading}
      placeholder={placeholder}
      label={label}
      className={className}
      showLabel={showLabel}
      allOptionLabel="All accounts"
      emptyLabel="No accounts available"
    />
  );
}
