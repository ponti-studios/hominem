import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
  type RefObject,
} from 'react';

export interface TopAnchoredFeedState {
  pendingRequestId: number;
  handledRequestId: number;
}

interface ShouldRevealTopInput {
  state: TopAnchoredFeedState;
  headKey: string | null;
  isFocused: boolean;
}

interface ScrollableListRef {
  scrollToOffset: (params: { offset: number; animated: boolean }) => void;
}

interface UseTopAnchoredFeedOptions {
  listRef?: RefObject<ScrollableListRef | null>;
  headKey?: string | null;
  isFocused?: boolean;
}

interface TopAnchoredFeedContextValue {
  state: TopAnchoredFeedState;
  requestTopReveal: () => void;
  markTopRevealHandled: () => void;
}

const TopAnchoredFeedContext = createContext<TopAnchoredFeedContextValue | null>(null);

export function createTopAnchoredFeedState(): TopAnchoredFeedState {
  return {
    pendingRequestId: 0,
    handledRequestId: 0,
  };
}

export function requestTopReveal(state: TopAnchoredFeedState): TopAnchoredFeedState {
  return {
    ...state,
    pendingRequestId: state.pendingRequestId + 1,
  };
}

export function markTopRevealHandled(state: TopAnchoredFeedState): TopAnchoredFeedState {
  if (state.pendingRequestId === state.handledRequestId) {
    return state;
  }

  return {
    ...state,
    handledRequestId: state.pendingRequestId,
  };
}

export function shouldRevealTop({
  state,
  headKey,
  isFocused,
}: ShouldRevealTopInput): boolean {
  return state.pendingRequestId > state.handledRequestId && isFocused && headKey !== null;
}

function useTopAnchoredFeedContext() {
  const context = useContext(TopAnchoredFeedContext);

  if (!context) {
    throw new Error('useTopAnchoredFeed must be used within a TopAnchoredFeedProvider');
  }

  return context;
}

export function TopAnchoredFeedProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState(createTopAnchoredFeedState);

  const handleRequestTopReveal = useCallback(() => {
    setState((currentState) => requestTopReveal(currentState));
  }, []);

  const handleMarkTopRevealHandled = useCallback(() => {
    setState((currentState) => markTopRevealHandled(currentState));
  }, []);

  const value = useMemo<TopAnchoredFeedContextValue>(
    () => ({
      state,
      requestTopReveal: handleRequestTopReveal,
      markTopRevealHandled: handleMarkTopRevealHandled,
    }),
    [handleMarkTopRevealHandled, handleRequestTopReveal, state],
  );

  return <TopAnchoredFeedContext.Provider value={value}>{children}</TopAnchoredFeedContext.Provider>;
}

export function useTopAnchoredFeed({
  listRef,
  headKey = null,
  isFocused = false,
}: UseTopAnchoredFeedOptions = {}) {
  const { state, requestTopReveal: handleRequestTopReveal, markTopRevealHandled: handleMarkTopRevealHandled } =
    useTopAnchoredFeedContext();

  useEffect(() => {
    if (!listRef || !shouldRevealTop({ state, headKey, isFocused })) {
      return;
    }

    const frameId = requestAnimationFrame(() => {
      if (!listRef.current) {
        return;
      }

      listRef.current.scrollToOffset({ offset: 0, animated: true });
      handleMarkTopRevealHandled();
    });

    return () => cancelAnimationFrame(frameId);
  }, [handleMarkTopRevealHandled, headKey, isFocused, listRef, state]);

  return {
    requestTopReveal: handleRequestTopReveal,
  };
}
