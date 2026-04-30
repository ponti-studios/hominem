import { useCallback, useRef, useState } from 'react';
import type { NativeSyntheticEvent, TextInputSelectionChangeEventData } from 'react-native';

import { applyFormatCommand } from '~/components/notes/note-formatting';
import type { FormatCommand, TextSelection } from '~/components/notes/note-formatting';

interface HistoryEntry {
  text: string;
  selection: TextSelection;
}

interface UseNoteToolbarOptions {
  content: string;
  onContentChange: (text: string) => void;
}

export function useNoteToolbar({ content, onContentChange }: UseNoteToolbarOptions) {
  const selectionRef = useRef<TextSelection>({ start: 0, end: 0 });
  const contentRef = useRef(content);
  contentRef.current = content;

  const [controlledSelection, setControlledSelection] = useState<TextSelection | undefined>(undefined);

  const historyRef = useRef<HistoryEntry[]>([{ text: content, selection: { start: 0, end: 0 } }]);
  const historyIndexRef = useRef(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateHistory = useCallback((newText: string, newSelection: TextSelection) => {
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
    (newText: string, newSelection: TextSelection) => {
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
      setControlledSelection(undefined);
    },
    [],
  );

  const applyFormat = useCallback(
    (action: FormatCommand) => {
      const result = applyFormatCommand(contentRef.current, selectionRef.current, action);
      if (!result) return;
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
