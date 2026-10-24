import { useSyncExternalStore } from 'react';

// Live text of replies that are still arriving, keyed by the provisional
// message id. It lives outside React Query on purpose: every revealed word
// would otherwise rewrite the messages array and re-render the whole chat list.
// Only the one <StreamingMessageText> reading an id re-renders.
const textById = new Map<string, string>();
const listenersById = new Map<string, Set<() => void>>();

function notify(id: string) {
  for (const listener of listenersById.get(id) ?? []) {
    listener();
  }
}

export function appendStreamingMessageText(id: string, text: string) {
  textById.set(id, (textById.get(id) ?? '') + text);
  notify(id);
}

export function clearStreamingMessageText(id: string) {
  if (textById.delete(id)) {
    notify(id);
  }
}

export function subscribeToStreamingMessageText(id: string, listener: () => void) {
  let listeners = listenersById.get(id);
  if (!listeners) {
    listeners = new Set();
    listenersById.set(id, listeners);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      listenersById.delete(id);
    }
  };
}

export function getStreamingMessageText(id: string) {
  return textById.get(id) ?? '';
}

export function useStreamingMessageText(id: string) {
  return useSyncExternalStore(
    (listener) => subscribeToStreamingMessageText(id, listener),
    () => getStreamingMessageText(id),
  );
}
