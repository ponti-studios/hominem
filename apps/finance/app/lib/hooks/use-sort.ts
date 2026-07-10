import type { SortOption } from '@hominem/ui';
import { useState } from 'react';

interface UseSortOptions {
  initialSortOptions?: SortOption[];
}

export function useSort(options: UseSortOptions = {}) {
  const [sortOptions, setSortOptions] = useState<SortOption[]>(options.initialSortOptions ?? []);

  return {
    sortOptions,
    addSortOption: (opt: SortOption) => setSortOptions((prev) => [...prev, opt]),
    updateSortOption: (index: number, opt: SortOption) =>
      setSortOptions((prev) => prev.map((o, i) => (i === index ? opt : o))),
    removeSortOption: (index: number) =>
      setSortOptions((prev) => prev.filter((_, i) => i !== index)),
  };
}
