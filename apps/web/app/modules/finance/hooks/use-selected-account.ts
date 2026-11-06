import { useSyncExternalStore } from 'react';

// Cross-component account filter shared by the finance overview and the
// transaction filters. A module store keeps it dependency-free; it is not
// persisted and resets on reload.
let selectedAccounts: string[] = [];
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return selectedAccounts;
}

function setSelectedAccounts(accountIds: string[]) {
  selectedAccounts = accountIds;
  for (const listener of listeners) listener();
}

export function useSelectedAccount() {
  const accounts = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return {
    selectedAccounts: accounts,
    setSelectedAccounts,
    // Back-compat single-account view for pages that only filter by one account.
    selectedAccount: accounts[0] ?? 'all',
    setSelectedAccount: (accountId: string) =>
      setSelectedAccounts(accountId === 'all' ? [] : [accountId]),
  };
}
