export interface RestoredQueryStateInput<TData> {
  data: TData | undefined;
  isPending: boolean;
  isFetching: boolean;
  hasUsableData: (data: TData | undefined) => boolean;
}

export interface RestoredQueryStateOutput {
  hasUsableData: boolean;
  isInitialLoading: boolean;
  isRefreshing: boolean;
}

export const hasDefinedData = <TData>(data: TData | null | undefined) => data != null;

export const hasNonEmptyListData = <TItem>(data: readonly TItem[] | null | undefined) =>
  Array.isArray(data) && data.length > 0;

export function resolveRestoredQueryState<TData>({
  data,
  isPending,
  isFetching,
  hasUsableData,
}: RestoredQueryStateInput<TData>): RestoredQueryStateOutput {
  const ready = hasUsableData(data);

  return {
    hasUsableData: ready,
    isInitialLoading: isPending && !ready,
    isRefreshing: isFetching && ready,
  };
}
