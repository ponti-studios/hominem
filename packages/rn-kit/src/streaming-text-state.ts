// Pure chunk bookkeeping for StreamingText. Kept free of React/RN so it can be
// unit tested in node.

export type Chunk = { id: number; text: string; bornAt: number };
export type StreamState = { settled: string; chunks: Chunk[]; seen: string; nextId: number };

export function initialState(content: string): StreamState {
  return { settled: content, chunks: [], seen: content, nextId: 0 };
}

/** Fold newly arrived text into a fresh chunk. Replaced (non-extended) text resets. */
export function advance(state: StreamState, content: string, now: number): StreamState {
  if (content === state.seen) {
    return state;
  }
  // The text was replaced rather than extended (regenerate, edit): start over.
  if (!content.startsWith(state.seen)) {
    return initialState(content);
  }
  return {
    ...state,
    chunks: [
      ...state.chunks,
      { id: state.nextId, text: content.slice(state.seen.length), bornAt: now },
    ],
    nextId: state.nextId + 1,
    seen: content,
  };
}

/** Fold chunks older than `settleAfterMs` back into the plain settled run. */
export function settleOld(state: StreamState, now: number, settleAfterMs: number): StreamState {
  const cutoff = now - settleAfterMs;
  let settled = state.settled;
  let index = 0;
  while (index < state.chunks.length && state.chunks[index]!.bornAt <= cutoff) {
    settled += state.chunks[index]!.text;
    index += 1;
  }
  return index === 0 ? state : { ...state, settled, chunks: state.chunks.slice(index) };
}
