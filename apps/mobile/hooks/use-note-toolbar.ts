import { useCallback, useRef, useState } from 'react';
import type { NativeSyntheticEvent, TextInputSelectionChangeEventData } from 'react-native';

export type FormatAction =
  | 'bold'
  | 'italic'
  | 'code'
  | 'strikethrough'
  | 'heading'
  | 'bullet'
  | 'checklist'
  | 'indent'
  | 'outdent'
  | 'undo'
  | 'redo';

interface Selection {
  start: number;
  end: number;
}

interface HistoryEntry {
  text: string;
  selection: Selection;
}

interface UseNoteToolbarOptions {
  content: string;
  onContentChange: (text: string) => void;
}

// ── Text manipulation helpers ──────────────────────────────────────────────────

function lineStart(text: string, pos: number): number {
  const idx = text.lastIndexOf('\n', pos - 1);
  return idx === -1 ? 0 : idx + 1;
}

function wrapSelection(
  text: string,
  sel: Selection,
  prefix: string,
  suffix: string,
): { text: string; selection: Selection } {
  if (sel.start === sel.end) {
    // No selection: insert markers, place cursor between them for immediate typing
    const next = text.slice(0, sel.start) + prefix + suffix + text.slice(sel.start);
    const cursor = sel.start + prefix.length;
    return { text: next, selection: { start: cursor, end: cursor } };
  }

  const before = text.slice(0, sel.start);
  const selected = text.slice(sel.start, sel.end);
  const after = text.slice(sel.end);

  // Toggle off if selection is already wrapped
  if (selected.startsWith(prefix) && selected.endsWith(suffix)) {
    const inner = selected.slice(prefix.length, selected.length - suffix.length);
    return {
      text: before + inner + after,
      selection: { start: sel.start, end: sel.start + inner.length },
    };
  }

  // Wrap selection, collapse cursor after closing delimiter
  const end = sel.end + prefix.length + suffix.length;
  return {
    text: before + prefix + selected + suffix + after,
    selection: { start: end, end: end },
  };
}

function toggleLinePrefix(
  text: string,
  sel: Selection,
  prefix: string,
): { text: string; selection: Selection } {
  const start = lineStart(text, sel.start);
  const hasPrefix = text.slice(start, start + prefix.length) === prefix;

  if (hasPrefix) {
    const next = text.slice(0, start) + text.slice(start + prefix.length);
    const offset = prefix.length;
    return {
      text: next,
      selection: {
        start: Math.max(sel.start - offset, start),
        end: Math.max(sel.end - offset, start),
      },
    };
  }

  const next = text.slice(0, start) + prefix + text.slice(start);
  return {
    text: next,
    selection: { start: sel.start + prefix.length, end: sel.end + prefix.length },
  };
}

function indentLine(
  text: string,
  sel: Selection,
  spaces = '  ',
): { text: string; selection: Selection } {
  const start = lineStart(text, sel.start);
  const next = text.slice(0, start) + spaces + text.slice(start);
  return {
    text: next,
    selection: { start: sel.start + spaces.length, end: sel.end + spaces.length },
  };
}

function outdentLine(
  text: string,
  sel: Selection,
  spaces = '  ',
): { text: string; selection: Selection } {
  const start = lineStart(text, sel.start);
  const slice = text.slice(start);
  const match = slice.match(/^( {1,2})/);
  if (!match) return { text, selection: sel };
  const removed = match[1].length;
  const next = text.slice(0, start) + text.slice(start + removed);
  return {
    text: next,
    selection: {
      start: Math.max(sel.start - removed, start),
      end: Math.max(sel.end - removed, start),
    },
  };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useNoteToolbar({ content, onContentChange }: UseNoteToolbarOptions) {
  const selectionRef = useRef<Selection>({ start: 0, end: 0 });
  const contentRef = useRef(content);
  contentRef.current = content;

  // Declarative cursor placement: set after toolbar action, cleared on next user interaction.
  // More reliable than setNativeProps because React Native applies value + selection atomically.
  const [controlledSelection, setControlledSelection] = useState<Selection | undefined>(undefined);

  // Undo/redo history
  const historyRef = useRef<HistoryEntry[]>([{ text: content, selection: { start: 0, end: 0 } }]);
  const historyIndexRef = useRef(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateHistory = useCallback((newText: string, newSelection: Selection) => {
    const history = historyRef.current;
    const idx = historyIndexRef.current;
    const trimmed = history.slice(0, idx + 1);
    trimmed.push({ text: newText, selection: newSelection });
    if (trimmed.length > 50) trimmed.shift();
    historyRef.current = trimmed;
    historyIndexRef.current = trimmed.length - 1;
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(false);
  }, []);

  const applyChange = useCallback(
    (newText: string, newSelection: Selection) => {
      updateHistory(newText, newSelection);
      onContentChange(newText);
      setControlledSelection(newSelection);
    },
    [onContentChange, updateHistory],
  );

  const onTypingChange = useCallback(
    (newText: string) => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        updateHistory(newText, selectionRef.current);
      }, 800);
    },
    [updateHistory],
  );

  const onSelectionChange = useCallback(
    (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
      selectionRef.current = e.nativeEvent.selection;
      // Release cursor control so subsequent user input is unobstructed
      setControlledSelection(undefined);
    },
    [],
  );

  const applyFormat = useCallback(
    (action: FormatAction) => {
      const text = contentRef.current;
      const sel = selectionRef.current;
      let result: { text: string; selection: Selection };

      switch (action) {
        case 'bold':
          result = wrapSelection(text, sel, '**', '**');
          break;
        case 'italic':
          result = wrapSelection(text, sel, '_', '_');
          break;
        case 'code':
          result = wrapSelection(text, sel, '`', '`');
          break;
        case 'strikethrough':
          result = wrapSelection(text, sel, '~~', '~~');
          break;
        case 'heading':
          result = toggleLinePrefix(text, sel, '# ');
          break;
        case 'bullet':
          result = toggleLinePrefix(text, sel, '- ');
          break;
        case 'checklist':
          result = toggleLinePrefix(text, sel, '- [ ] ');
          break;
        case 'indent':
          result = indentLine(text, sel);
          break;
        case 'outdent':
          result = outdentLine(text, sel);
          break;
        default:
          return;
      }

      applyChange(result.text, result.selection);
    },
    [applyChange],
  );

  const undo = useCallback(() => {
    const idx = historyIndexRef.current;
    if (idx <= 0) return;
    const prev = historyRef.current[idx - 1];
    historyIndexRef.current = idx - 1;
    setCanUndo(idx - 1 > 0);
    setCanRedo(true);
    onContentChange(prev.text);
    setControlledSelection(prev.selection);
  }, [onContentChange]);

  const redo = useCallback(() => {
    const idx = historyIndexRef.current;
    const history = historyRef.current;
    if (idx >= history.length - 1) return;
    const next = history[idx + 1];
    historyIndexRef.current = idx + 1;
    setCanUndo(true);
    setCanRedo(idx + 1 < history.length - 1);
    onContentChange(next.text);
    setControlledSelection(next.selection);
  }, [onContentChange]);

  return {
    onSelectionChange,
    onTypingChange,
    applyFormat,
    undo,
    redo,
    canUndo,
    canRedo,
    controlledSelection,
  };
}
