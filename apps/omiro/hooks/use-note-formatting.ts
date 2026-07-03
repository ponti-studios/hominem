import { useCallback, useRef, useState } from 'react';
import type { NativeSyntheticEvent, TextInputSelectionChangeEventData } from 'react-native';

import { applyFormatCommand } from '~/components/notes/note-formatting';
import type { FormatCommand, TextSelection } from '~/components/notes/note-formatting';

export function useNoteFormatting() {
  const selectionRef = useRef<TextSelection>({ start: 0, end: 0 });
  const [controlledSelection, setControlledSelection] = useState<TextSelection | undefined>(
    undefined,
  );

  const onSelectionChange = useCallback(
    (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
      selectionRef.current = e.nativeEvent.selection;
      setControlledSelection(undefined);
    },
    [],
  );

  const applyFormat = useCallback((content: string, command: FormatCommand) => {
    const result = applyFormatCommand(content, selectionRef.current, command);
    setControlledSelection(result.selection);
    return result.text;
  }, []);

  return {
    onSelectionChange,
    applyFormat,
    controlledSelection,
  };
}
