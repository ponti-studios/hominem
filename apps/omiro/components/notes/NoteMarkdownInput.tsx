import type { MarkdownStyle } from '@expensify/react-native-live-markdown';
import MarkdownTextInput from '@expensify/react-native-live-markdown/src/MarkdownTextInput';
import { forwardRef, type ComponentRef } from 'react';
import type { TextInputProps } from 'react-native';

import { parseNoteMarkdown } from '~/components/notes/note-markdown-parser';

export type NoteMarkdownInputHandle = ComponentRef<typeof MarkdownTextInput>;

interface NoteMarkdownInputProps extends TextInputProps {
  markdownStyle: MarkdownStyle;
}

// The note body: a TextInput that styles the markdown typed into it. The handle is a TextInput, so
// focus() and friends work as they do on the input it replaces.
export const NoteMarkdownInput = forwardRef<NoteMarkdownInputHandle, NoteMarkdownInputProps>(
  function NoteMarkdownInput(props, ref) {
    return <MarkdownTextInput {...props} parser={parseNoteMarkdown} ref={ref} />;
  },
);
