import type { MarkdownStyle } from '@expensify/react-native-live-markdown';
import MarkdownTextInput from '@expensify/react-native-live-markdown/src/MarkdownTextInput';
import { forwardRef, useCallback } from 'react';
import type { TextInputInstance, TextInputProps } from 'react-native';

import { parseNoteMarkdown } from '~/components/notes/note-markdown-parser';

export type NoteMarkdownInputHandle = TextInputInstance;

interface NoteMarkdownInputProps extends TextInputProps {
  markdownStyle: MarkdownStyle;
}

// live-markdown still types its ref against the pre-0.88 TextInput class, but what it hands back is
// a real TextInput. Check for that at runtime instead of casting past the mismatch.
function isTextInputInstance(node: object): node is TextInputInstance {
  return 'focus' in node && typeof node.focus === 'function';
}

// The note body: a TextInput that styles the markdown typed into it. The handle is a TextInput, so
// focus() and friends work as they do on the input it replaces.
export const NoteMarkdownInput = forwardRef<NoteMarkdownInputHandle, NoteMarkdownInputProps>(
  function NoteMarkdownInput(props, ref) {
    const setRef = useCallback(
      (node: object | null) => {
        const handle = node && isTextInputInstance(node) ? node : null;
        if (typeof ref === 'function') {
          ref(handle);
        } else if (ref) {
          ref.current = handle;
        }
      },
      [ref],
    );

    return <MarkdownTextInput {...props} parser={parseNoteMarkdown} ref={setRef} />;
  },
);
