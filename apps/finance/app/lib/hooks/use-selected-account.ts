import { create } from 'zustand';

interface SelectedAccountState {
  selectedAccount: string;
  setSelectedAccount: (accountId: string) => void;
}

const useSelectedAccountStore = create<SelectedAccountState>((set) => ({
  selectedAccount: 'all',
  setSelectedAccount: (accountId: string) => set({ selectedAccount: accountId }),
}));

export function useSelectedAccount() {
  return useSelectedAccountStore();
}
