import { computed, signal, type ReadonlySignal, type Signal } from '@preact/signals-react';
import type { QueryClient, QueryKey } from '@tanstack/react-query';

export function createSignalStore<T>(initialValue: T): Signal<T> {
  return signal(initialValue);
}

export function createDerivedSignal<T>(derive: () => T): ReadonlySignal<T> {
  return computed(derive);
}

export function bridgeQueryDataToSignal<TData, TSelected = TData>(input: {
  queryClient: QueryClient;
  queryKey: QueryKey;
  target: Signal<TSelected | null>;
  select?: (data: TData | undefined) => TSelected | null;
}) {
  const { queryClient, queryKey, target, select } = input;

  const updateFromQuery = () => {
    const data = queryClient.getQueryData<TData>(queryKey);
    target.value = select ? select(data) : ((data ?? null) as TSelected | null);
  };

  updateFromQuery();

  const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
    if (!event?.query || !event.query.queryKey) {
      return;
    }

    const isSameKey = JSON.stringify(event.query.queryKey) === JSON.stringify(queryKey);
    if (!isSameKey) {
      return;
    }

    updateFromQuery();
  });

  return {
    dispose() {
      unsubscribe();
    },
    refresh: updateFromQuery,
  };
}
