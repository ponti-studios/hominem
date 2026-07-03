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

export interface TopAnchoredInboxState {
  pendingRequestId: number;
  handledRequestId: number;
}

interface ShouldRevealTopInput {
  state: TopAnchoredInboxState;
  headKey: string | null;
  isFocused: boolean;
}

interface ScrollableListRef {
  scrollToOffset: (params: { offset: number; animated: boolean }) => void;
}

interface UseTopAnchoredInboxOptions {
  listRef?: RefObject<ScrollableListRef | null>;
  headKey?: string | null;
  isFocused?: boolean;
}

interface TopAnchoredInboxContextValue {
  state: TopAnchoredInboxState;
  requestTopReveal: () => void;
  markTopRevealHandled: () => void;
}

const TopAnchoredInboxContext = createContext<TopAnchoredInboxContextValue | null>(null);

export function createTopAnchoredInboxState(): TopAnchoredInboxState {
  return {
    pendingRequestId: 0,
    handledRequestId: 0,
  };
}

export function requestTopReveal(state: TopAnchoredInboxState): TopAnchoredInboxState {
  return {
    ...state,
    pendingRequestId: state.pendingRequestId + 1,
  };
}

export function markTopRevealHandled(state: TopAnchoredInboxState): TopAnchoredInboxState {
  if (state.pendingRequestId === state.handledRequestId) {
    return state;
  }

  return {
    ...state,
    handledRequestId: state.pendingRequestId,
  };
}

export function shouldRevealTop({ state, headKey, isFocused }: ShouldRevealTopInput): boolean {
  return state.pendingRequestId > state.handledRequestId && isFocused && headKey !== null;
}

function useTopAnchoredInboxContext() {
  const context = useContext(TopAnchoredInboxContext);

  if (!context) {
    throw new Error('useTopAnchoredInbox must be used within a TopAnchoredInboxProvider');
  }

  return context;
}

export function TopAnchoredInboxProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState(createTopAnchoredInboxState);

  const handleRequestTopReveal = useCallback(() => {
    setState((currentState) => requestTopReveal(currentState));
  }, []);

  const handleMarkTopRevealHandled = useCallback(() => {
    setState((currentState) => markTopRevealHandled(currentState));
  }, []);

  const value = useMemo<TopAnchoredInboxContextValue>(
    () => ({
      state,
      requestTopReveal: handleRequestTopReveal,
      markTopRevealHandled: handleMarkTopRevealHandled,
    }),
    [handleMarkTopRevealHandled, handleRequestTopReveal, state],
  );

  return (
    <TopAnchoredInboxContext.Provider value={value}>{children}</TopAnchoredInboxContext.Provider>
  );
}

export function useTopAnchoredInbox({
  listRef,
  headKey = null,
  isFocused = false,
}: UseTopAnchoredInboxOptions = {}) {
  const {
    state,
    requestTopReveal: handleRequestTopReveal,
    markTopRevealHandled: handleMarkTopRevealHandled,
  } = useTopAnchoredInboxContext();

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
